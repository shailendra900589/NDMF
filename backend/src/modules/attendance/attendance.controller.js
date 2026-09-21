const { v4: uuid } = require('uuid');
const { getCollection, upsert } = require('../../lib/db');
const { success, error } = require('../../lib/response');
const { filterByBranchViaUser, isAdmin, sameBranch } = require('../../lib/rbac');

const BRANCH_LAT = 28.6139;
const BRANCH_LNG = 77.209;

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

exports.checkIn = (req, res) => {
  const { lat, lng } = req.body;
  if (lat == null || lng == null) return error(res, 'GPS location required');

  const today = new Date().toISOString().split('T')[0];
  const attendance = getCollection('attendance');
  const existing = attendance.find(
    (a) => a.userId === req.user.id && a.date.startsWith(today)
  );

  if (existing && existing.checkInTime) {
    return error(res, 'Already checked in today');
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
  record.checkInLat = lat;
  record.checkInLng = lng;
  record.distanceFromBranch = Math.round(distanceMeters(lat, lng, BRANCH_LAT, BRANCH_LNG));

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
