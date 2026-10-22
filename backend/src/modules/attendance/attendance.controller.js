const { v4: uuid } = require('uuid');
const { getCollection, findById, upsert } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { filterByBranchViaUser, isAdmin, sameBranch } = require('../../lib/rbac');
const { getAppSettings } = require('../../lib/appSettings');
const {
  FaceCheckError,
  describeFace,
  compare,
  isEnrollmentComplete,
  ensureEnrolledDescriptors,
} = require('../../lib/faceMatch');
const { checkAttendancePosition, workTypeOf } = require('../../lib/officeGeofence');

/** A passed face check is good for one check-in within this window. */
const FACE_PASS_TTL_MS = 10 * 60 * 1000;
const FACE_FAIL_WINDOW_MS = 15 * 60 * 1000;
const FACE_FAIL_LIMIT = 5;

function dateKey(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function teamForActor(actor, allUsers, branchFilter) {
  if (actor.role === 'fieldOfficer') {
    return allUsers.filter((u) => u.id === actor.id);
  }
  let team = allUsers.filter((u) => u.isActive !== false && u.role !== 'admin');
  if (isAdmin(actor)) {
    if (branchFilter) {
      team = team.filter((u) => sameBranch({ branch: branchFilter }, u.branch));
    }
  } else {
    team = team.filter((u) => sameBranch(actor, u.branch));
  }
  team.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return team;
}

function requiresFaceVerification(user) {
  if (!getAppSettings().faceAttendanceRequired) return false;
  return user.role === 'fieldOfficer' || user.role === 'branchManager';
}

exports.checkIn = (req, res) => {
  const { lat, lng, accuracy } = req.body;
  if (lat == null || lng == null) return error(res, 'GPS location required');
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    return error(res, 'GPS location is not valid');
  }

  const user = findById('users', req.user.id) || req.user;
  const faceRequired = requiresFaceVerification(user);
  let facePass = null;
  if (faceRequired) {
    if (!isEnrollmentComplete(user)) {
      return error(res, 'Complete face enrollment (3 photos) before attendance', 403);
    }
    facePass = user.faceVerification;
    const fresh =
      facePass &&
      !facePass.usedAt &&
      new Date(facePass.expiresAt).getTime() > Date.now();
    if (!fresh) {
      return error(res, 'Live face verification required for check-in', 400);
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const attendance = getCollection('attendance');
  const existing = attendance.find(
    (a) => a.userId === req.user.id && a.date.startsWith(today)
  );

  if (existing && existing.checkInTime) {
    return error(res, 'Already checked in today');
  }

  const place = checkAttendancePosition(user, lat, lng, accuracy);
  if (!place.allowed) {
    return res.status(403).json({
      success: false,
      message: place.message,
      data: {
        reason: 'outside_office',
        distanceMeters: place.distanceMeters,
        radiusMeters: place.radiusMeters,
        office: place.officeName,
      },
    });
  }

  const record = existing || {
    id: `ATT_${uuid().slice(0, 8)}`,
    userId: req.user.id,
    employeeId: req.user.employeeId,
    branch: req.user.branch,
    date: new Date().toISOString(),
    status: 'Present',
  };

  record.checkInTime = new Date().toISOString();
  record.checkInLat = Number(lat);
  record.checkInLng = Number(lng);
  record.distanceFromBranch = place.distanceMeters;
  record.workType = place.workType;
  record.officeRadiusM = place.radiusMeters;
  record.faceVerified = !!facePass;
  if (facePass) {
    record.faceMatchScore = facePass.matchScore;
    record.faceVerifiedAt = facePass.verifiedAt;
    facePass.usedAt = new Date().toISOString();
    upsert('users', user);
  }

  upsert('attendance', record);
  return success(res, record, 'Checked in successfully');
};

exports.checkOut = (req, res) => {
  const { lat, lng } = req.body;
  if (lat == null || lng == null) return error(res, 'GPS location required');

  const today = new Date().toISOString().split('T')[0];
  const attendance = getCollection('attendance');
  const record = attendance.find(
    (a) => a.userId === req.user.id && a.date.startsWith(today)
  );

  if (!record || !record.checkInTime) {
    return error(res, 'Check in first');
  }
  if (record.checkOutTime) {
    return error(res, 'Already checked out today');
  }

  record.checkOutTime = new Date().toISOString();
  record.checkOutLat = lat;
  record.checkOutLng = lng;

  upsert('attendance', record);
  return success(res, record, 'Checked out successfully');
};

function recentFailures(user) {
  const since = Date.now() - FACE_FAIL_WINDOW_MS;
  return (user.faceVerifyFailures || []).filter((t) => new Date(t).getTime() > since);
}

/**
 * Live selfie is compared with the employee's own enrolled face.
 * The image is NOT stored (processed in memory).
 */
exports.verifyLiveFace = async (req, res) => {
  if (!requiresFaceVerification(req.user)) {
    return success(res, { verified: true, matchScore: 1, skipped: true, message: 'Face not required' });
  }
  if (!req.file) return error(res, 'Live photo required');
  const user = findById('users', req.user.id);
  if (!user) return error(res, 'User not found', 404);
  if (!isEnrollmentComplete(user)) {
    return error(res, 'Face enrollment incomplete', 403);
  }
  if (recentFailures(user).length >= FACE_FAIL_LIMIT) {
    return error(res, 'Too many failed face checks — try again in 15 minutes', 429);
  }

  const save = (u) => upsert('users', u);
  let enrolled;
  try {
    enrolled = await ensureEnrolledDescriptors(user, save);
  } catch (err) {
    if (err instanceof FaceCheckError) {
      return error(
        res,
        'Your saved face photos are not clear. Open Profile → Face enrollment and capture 3 new selfies.',
        403
      );
    }
    console.error('Face enrollment load failed:', err);
    return error(res, 'Face check is not available right now — try again in a minute', 503);
  }

  const fail = (message, reason, extra = {}) => {
    user.faceVerifyFailures = [...recentFailures(user), new Date().toISOString()];
    user.faceVerification = null;
    save(user);
    return success(res, { verified: false, matchScore: 0, reason, message, ...extra });
  };

  let live;
  try {
    live = await describeFace(req.file.buffer);
  } catch (err) {
    if (err instanceof FaceCheckError) return fail(err.message, err.code);
    console.error('Live face check failed:', err);
    return error(res, 'Face check is not available right now — try again in a minute', 503);
  }

  const result = compare(live.descriptor, enrolled);
  if (!result.matched) {
    return fail('Face does not match the registered employee', 'mismatch', { matchScore: result.matchScore });
  }

  const now = new Date();
  user.faceVerification = {
    id: uuid(),
    verifiedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + FACE_PASS_TTL_MS).toISOString(),
    matchScore: result.matchScore,
    distance: result.distance,
  };
  user.faceVerifyFailures = [];
  save(user);
  return success(res, {
    verified: true,
    matchScore: result.matchScore,
    message: 'Face verified',
  });
};

exports.getHistory = (req, res) => {
  const users = getCollection('users');
  let history = getCollection('attendance');
  if (req.user.role === 'fieldOfficer') {
    history = history.filter((a) => a.userId === req.user.id);
  } else {
    history = filterByBranchViaUser(history, req.user, users);
  }
  history.sort((a, b) => new Date(b.date) - new Date(a.date));
  return success(res, history);
};

/** Monthly calendar report — employees × days */
exports.getMonthly = (req, res) => {
  const now = new Date();
  const year = parseInt(req.query.year || now.getFullYear(), 10);
  const month = parseInt(req.query.month || now.getMonth() + 1, 10);
  if (!year || month < 1 || month > 12) {
    return error(res, 'Invalid year or month');
  }

  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const totalDays = daysInMonth(year, month);
  const todayKey = now.toISOString().slice(0, 10);
  const users = getCollection('users');
  const team = teamForActor(req.user, users, req.query.branch);

  let history = getCollection('attendance').filter((a) =>
    dateKey(a.date).startsWith(prefix)
  );
  if (req.user.role === 'fieldOfficer') {
    history = history.filter((a) => a.userId === req.user.id);
  } else {
    history = filterByBranchViaUser(history, req.user, users);
    if (req.query.branch) {
      history = history.filter((a) =>
        sameBranch({ branch: req.query.branch }, a.branch)
      );
    }
  }

  const byUserDay = {};
  history.forEach((a) => {
    const d = dateKey(a.date);
    const uid = a.userId;
    if (!uid || !d) return;
    if (!byUserDay[uid]) byUserDay[uid] = {};
    byUserDay[uid][d] = a;
  });

  const employees = team.map((u) => {
    const days = {};
    let present = 0;
    let partial = 0;
    for (let day = 1; day <= totalDays; day += 1) {
      const key = `${prefix}-${String(day).padStart(2, '0')}`;
      const rec = byUserDay[u.id]?.[key];
      let status = 'none';
      if (rec?.checkInTime && rec?.checkOutTime) {
        status = 'present';
        present += 1;
      } else if (rec?.checkInTime) {
        status = 'partial';
        partial += 1;
        present += 1;
      } else if (key < todayKey) {
        const wd = new Date(`${key}T12:00:00`).getDay();
        status = wd === 0 ? 'holiday' : 'absent';
      } else if (key === todayKey) {
        status = 'today';
      }
      days[day] = {
        date: key,
        status,
        checkInTime: rec?.checkInTime || null,
        checkOutTime: rec?.checkOutTime || null,
        distanceFromBranch: rec?.distanceFromBranch ?? null,
        recordId: rec?.id || null,
      };
    }
    return {
      id: u.id,
      name: u.name,
      employeeId: u.employeeId,
      mobile: u.mobile,
      role: u.role,
      branch: u.branch,
      workType: workTypeOf(u),
      presentDays: present,
      partialDays: partial,
      workingDaysSoFar: Object.values(days).filter((d) =>
        ['present', 'partial', 'absent'].includes(d.status)
      ).length,
      days,
    };
  });

  const dayNum = now.getDate();
  const presentToday = employees.filter((e) => {
    if (!todayKey.startsWith(prefix)) return false;
    const d = e.days[dayNum];
    return d && (d.status === 'present' || d.status === 'partial');
  }).length;

  return success(res, {
    year,
    month,
    monthLabel: new Date(year, month - 1, 1).toLocaleString('en-IN', {
      month: 'long',
      year: 'numeric',
    }),
    daysInMonth: totalDays,
    today: todayKey,
    scope: isAdmin(req.user) ? 'all_branches' : 'branch',
    branch: req.user.branch || null,
    employeeCount: employees.length,
    presentToday,
    employees,
  });
};
