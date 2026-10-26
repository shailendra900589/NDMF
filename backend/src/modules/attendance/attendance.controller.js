const { v4: uuid } = require('uuid');
const { getCollection, findById, upsert, flush } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { filterByBranchViaUser, isAdmin, sameBranch } = require('../../lib/rbac');
const { getAppSettings } = require('../../lib/appSettings');
const {
  FaceCheckError,
  describeFace,
  compare,
  isEnrollmentComplete,
  ensureEnrolledDescriptors,
  enrollmentUrls,
  enrollmentStatus,
  enrollmentRevision,
} = require('../../lib/faceMatch');
const { checkAttendancePosition, workTypeOf } = require('../../lib/officeGeofence');
const { attendanceDay: dateKey } = require('../../lib/attendanceDay');
const {salaryUpdate}=require('../../lib/payrollCalculation');
const canCorrect=(actor,target)=>isAdmin(actor) || (actor.role==='branchManager' && target?.role==='fieldOfficer' && sameBranch(actor,target.branch));

exports.setSalary=async(req,res)=>{
  const target=findById('users',req.params.userId);
  if(!target || target.isDeleted)return error(res,'Employee not found',404);
  if(!canCorrect(req.user,target))return error(res,'You cannot set this employee salary',403);
  const {amount,month,reason}=req.body;
  if(typeof reason!=='string' || reason.trim().length<3 || reason.length>500)return error(res,'Enter a salary change reason (3–500 characters)');
  let updated;try{updated=salaryUpdate(target,amount,month,req.user.id);}catch(e){return error(res,e.message);}
  upsert('users',updated,{single:true});upsert('platformAudit',{id:uuid(),companyId:req.user.companyId,actorId:req.user.id,action:'employee.salary.updated',targetId:target.id,amount:Number(amount),month,reason:reason.trim(),createdAt:new Date().toISOString()},{single:true});await flush();
  return success(res,{userId:target.id,monthlySalary:updated.monthlySalary,salaryHistory:updated.salaryHistory},'Salary updated');
};

exports.adjust = async(req,res)=>{
  const {userId,date,status,reason}=req.body;
  const target=findById('users',userId);
  if(!target || target.role==='admin' || target.isDeleted)return error(res,'Employee not found',404);
  if(!canCorrect(req.user,target))return error(res,'You cannot correct this employee attendance',403);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date || date>dateKey())return error(res,'Select a valid date, today or earlier');
  if(!['present','absent','paid_leave','unpaid_leave','holiday','automatic'].includes(status) || typeof reason!=='string' || reason.trim().length<3 || reason.length>500)return error(res,'Choose a status and enter a reason (3–500 characters)');
  const id=`ADJ_${target.id}_${date}`,previous=findById('attendanceAdjustments',id);
  const record={id,userId,date,status,reason:reason.trim(),branch:target.branch,updatedAt:new Date().toISOString(),updatedBy:req.user.id};
  upsert('attendanceAdjustments',record,{single:true});
  upsert('platformAudit',{id:uuid(),companyId:req.user.companyId,actorId:req.user.id,action:'attendance.corrected',targetId:userId,date,previousStatus:previous?.status || 'automatic',status,reason:record.reason,createdAt:record.updatedAt},{single:true});
  await flush();return success(res,record,'Attendance correction saved. Original GPS and biometric records are preserved.');
};

exports.getEnrollmentPhotos = (req, res) => {
  const target = findById('users', req.params.userId);
  if (!target) return error(res, 'Employee not found', 404);
  const own = target.id === req.user.id;
  const manager = req.user.role === 'branchManager' && sameBranch(req.user, target.branch) && target.role === 'fieldOfficer';
  if (!own && !isAdmin(req.user) && !manager) return error(res, 'You cannot view this employee’s registration photos', 403);
  const photos = enrollmentUrls(target).slice(0, 5);
  res.setHeader('Cache-Control', 'private, no-store');
  return success(res, { userId: target.id, name: target.name, complete: isEnrollmentComplete(target),
    enrolledAt: target.faceEnrollmentAt || null, photos }, 'Attendance registration photos');
};

/** A passed face check is good for one check-in within this window. */
const FACE_PASS_TTL_MS = 10 * 60 * 1000;
const FACE_FAIL_WINDOW_MS = 15 * 60 * 1000;
const FACE_FAIL_LIMIT = 5;

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

function enrollmentError(res, user) {
  const status = enrollmentStatus(user);
  const message = status.registered
    ? `Face registration needs attention: ${status.problem || 'saved photos could not be verified'}. Open Profile → Face enrollment to register again.`
    : 'Complete face enrollment (3 different reference selfies) in Profile before attendance.';
  return res.status(403).json({ success: false, message, data: status });
}

function validPosition(lat, lng) {
  return ['number','string'].includes(typeof lat) && ['number','string'].includes(typeof lng) &&
    String(lat).trim() !== '' && String(lng).trim() !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) &&
    Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
}

function activeShift(record, userId) {
  const age = Date.now() - Date.parse(record.checkInTime);
  return record.userId === userId && !record.checkOutTime && age >= 0 && age <= 20 * 60 * 60 * 1000;
}

exports.checkIn = async (req, res) => {
  const policy = getAppSettings().attendanceTiming;
  const timing = require('../../lib/attendanceTiming').timingAt(policy);
  if (!timing.allowed) return error(res, `Check-in is available ${policy.opensAt}–${policy.closesAt} IST. Contact your administrator for an attendance correction.`, 403);
  const { lat, lng, accuracy } = req.body;
  if (lat == null || lng == null) return error(res, 'GPS location required');
  if (!validPosition(lat, lng)) {
    return error(res, 'GPS location is not valid');
  }
  const today = dateKey();
  const attendance = getCollection('attendance');
  const existing = attendance.find(a => a.userId === req.user.id && dateKey(a.date) === today);
  if (existing?.checkInTime) return error(res, 'Already checked in today');
  if (attendance.some(a => activeShift(a,req.user.id))) return error(res, 'Check out from your current shift before checking in again');

  const user = findById('users', req.user.id) || req.user;
  const faceRequired = requiresFaceVerification(user);
  let facePass = null;
  if (faceRequired) {
    if (!isEnrollmentComplete(user)) {
      return enrollmentError(res, user);
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
  record.attendanceTiming = policy;
  record.lateMinutes = timing.lateMinutes;
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
  await flush();
  return success(res, record, 'Checked in successfully');
};

exports.checkOut = async (req, res) => {
  const { lat, lng } = req.body;
  if (lat == null || lng == null) return error(res, 'GPS location required');
  if (!validPosition(lat, lng)) return error(res, 'GPS location is not valid');

  const today = dateKey();
  const attendance = getCollection('attendance');
  const record = attendance.filter(a => activeShift(a,req.user.id))
    .sort((a,b) => Date.parse(b.checkInTime)-Date.parse(a.checkInTime))[0] ||
    attendance.find(a => a.userId === req.user.id && dateKey(a.date) === today);

  if (!record || !record.checkInTime) {
    return error(res, 'Check in first');
  }
  if (record.checkOutTime) {
    return error(res, 'Already checked out today');
  }

  const user = findById('users', req.user.id) || req.user;
  let facePass = null;
  if (['fieldOfficer', 'branchManager'].includes(user.role)) {
    if (!isEnrollmentComplete(user)) return enrollmentError(res, user);
    facePass = user.faceVerification;
    if (!facePass || facePass.usedAt || !(new Date(facePass.expiresAt).getTime() > Date.now())) {
      return error(res, 'Fresh live face verification required for check-out', 400);
    }
    facePass.usedAt = new Date().toISOString();
    upsert('users', user);
  }
  record.checkOutFaceVerified = !!facePass;
  record.checkOutFaceVerifiedAt = facePass?.verifiedAt || null;
  record.checkOutFaceMatchScore = facePass?.matchScore ?? null;

  record.checkOutTime = new Date().toISOString();
  record.earlyDepartureMinutes = require('../../lib/attendanceTiming').timingAt(record.attendanceTiming || getAppSettings().attendanceTiming).earlyDepartureMinutes;
  record.checkOutLat = Number(lat);
  record.checkOutLng = Number(lng);

  upsert('attendance', record);
  await flush();
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
  if (!requiresFaceVerification(req.user) && !(req.body.purpose === 'checkout' && ['fieldOfficer','branchManager'].includes(req.user.role))) {
    return success(res, { verified: true, matchScore: 1, skipped: true, message: 'Face not required' });
  }
  if (!req.file) return error(res, 'Live photo required');
  const storedUser = findById('users', req.user.id);
  if (!storedUser) return error(res, 'User not found', 404);
  const user = structuredClone(storedUser);
  if (!isEnrollmentComplete(user)) {
    return enrollmentError(res, user);
  }
  if (recentFailures(user).length >= FACE_FAIL_LIMIT) {
    return error(res, 'Too many failed face checks — try again in 15 minutes', 429);
  }

  const revision = enrollmentRevision(user);
  const save = u => {
    const current = findById('users', user.id);
    if (!current || current.isActive === false || enrollmentRevision(current) !== revision) {
      throw new FaceCheckError('Face registration changed. Refresh your profile and verify again.', 'enrollment_changed');
    }
    // Preserve profile/permission changes made while face inference was running.
    const faceFields = ['faceDescriptors','faceDescriptorUrls','faceDescriptorVersion','faceEnrollmentValid',
      'faceEnrollmentProblem','faceVerification','faceVerifyFailures'];
    const next = { ...current };
    for (const key of faceFields) {
      if (Object.hasOwn(u,key)) next[key] = u[key]; else delete next[key];
    }
    upsert('users', next, { single: true });
  };
  let enrolled;
  try {
    enrolled = await ensureEnrolledDescriptors(user, save);
  } catch (err) {
    if (err instanceof FaceCheckError) {
      if (err.code === 'enrollment_changed') return error(res, err.message, 409);
      await flush();
      return error(
        res,
        'Your saved face photos are not clear. Open Profile → Face enrollment and capture 3 new selfies.',
        403
      );
    }
    console.error('Face enrollment load failed:', err);
    return error(res, 'Face check is not available right now — try again in a minute', 503);
  }

  const fail = async (message, reason, extra = {}) => {
    user.faceVerifyFailures = [...recentFailures(user), new Date().toISOString()];
    user.faceVerification = null;
    try { save(user); } catch (err) { if (err.code === 'enrollment_changed') return error(res,err.message,409); throw err; }
    await flush();
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
  try { save(user); } catch (err) { if (err.code === 'enrollment_changed') return error(res,err.message,409); throw err; }
  await flush();
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
  const todayKey = dateKey(now);
  const adjustments=getCollection('attendanceAdjustments').filter(a=>a.date.startsWith(prefix));
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
      const adjustment=adjustments.find(a=>a.userId===u.id && a.date===key && a.status!=='automatic');
      if(adjustment){
        if(['present','partial'].includes(status)){present--;if(status==='partial')partial--;}
        status=adjustment.status;if(status==='present')present++;
      }
      days[day] = {
        date: key,
        status,
        checkInTime: rec?.checkInTime || null,
        checkOutTime: rec?.checkOutTime || null,
        lateMinutes: rec?.lateMinutes || 0,
        earlyDepartureMinutes: rec?.earlyDepartureMinutes || 0,
        distanceFromBranch: rec?.distanceFromBranch ?? null,
        recordId: rec?.id || null,
        correction:adjustment ? {status:adjustment.status,reason:adjustment.reason,updatedAt:adjustment.updatedAt,updatedBy:adjustment.updatedBy} : null,
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
      ...(canCorrect(req.user,u)?{monthlySalary:u.monthlySalary || null,salaryHistory:u.salaryHistory || []}:{}),
      presentDays: present,
      partialDays: partial,
      paidLeaveDays:Object.values(days).filter(d=>d.status==='paid_leave').length,
      unpaidLeaveDays:Object.values(days).filter(d=>d.status==='unpaid_leave').length,
      absentDays:Object.values(days).filter(d=>d.status==='absent').length,
      holidayDays:Object.values(days).filter(d=>d.status==='holiday').length,
      workingDaysSoFar: Object.values(days).filter((d) =>
        ['present', 'partial', 'absent'].includes(d.status)
      ).length,
      days,
    };
  });

  const dayNum = Number(todayKey.slice(-2));
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
