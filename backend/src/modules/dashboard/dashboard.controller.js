const { getCollection } = require('../../lib/db');
const { success } = require('../../lib/response');
const { normalizeRecordingUrl } = require('../../lib/mediaUrl');
const { isAdmin, filterByBranch, filterByBranchViaUser } = require('../../lib/rbac');

exports.getStats = (req, res) => {
  const users = getCollection('users');
  let customers = getCollection('customers');
  let attendance = getCollection('attendance');
  let tracking = getCollection('tracking');
  let callLogs = getCollection('callLogs');
  const branches = getCollection('branches');

  customers = filterByBranch(customers, req.user, 'branch');
  attendance = filterByBranchViaUser(attendance, req.user, users);
  tracking = filterByBranchViaUser(tracking, req.user, users);
  callLogs = filterByBranchViaUser(callLogs, req.user, users);

  const today = new Date().toISOString().split('T')[0];
  const todayAttendance = attendance.find(
    (a) => a.userId === req.user.id && a.date.startsWith(today)
  );
  const todayTracking = tracking.find((t) => t.userId === req.user.id && t.date.startsWith(today));

  const callsToday = callLogs.filter((c) => String(c.date).startsWith(today));
  const callsWithRecording = callLogs.filter((c) => c.recordingUrl);
  const recentCallRecordings = callLogs
    .filter((c) => c.recordingUrl)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10)
    .map((c) => {
      const user = users.find((u) => u.id === c.userId);
      return {
        ...c,
        recordingUrl: normalizeRecordingUrl(c.recordingUrl),
        employeeName: c.employeeName || user?.name || c.employeeId,
      };
    });

  const branchUsers = isAdmin(req.user)
    ? users.filter((u) => u.isActive !== false)
    : users.filter((u) => u.branch === req.user.branch && u.isActive !== false);

  const stats = {
    scope: isAdmin(req.user) ? 'all_branches' : 'branch',
    branch: req.user.branch,
    branchCount: isAdmin(req.user) ? branches.length : 1,
    teamMembers: branchUsers.length,
    totalCustomers: customers.length,
    attendanceStatus: todayAttendance
      ? todayAttendance.checkOutTime
        ? 'Checked Out'
        : 'Checked In'
      : 'Not Checked In',
    distanceCoveredToday: todayTracking?.totalKm || 0,
    totalCallsToday: callsToday.length,
    totalCallsWithRecording: callsWithRecording.length,
    recentCallRecordings,
  };

  return success(res, stats);
};
