/**
 * MAIN ROUTES — production API
 */
const express = require('express');
const router = express.Router();

const authRoutes = require('../modules/auth/auth.routes');
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');
const customersRoutes = require('../modules/customers/customers.routes');
const customerListingsRoutes = require('../modules/customerListings/customerListings.routes');
const attendanceRoutes = require('../modules/attendance/attendance.routes');
const trackingRoutes = require('../modules/tracking/tracking.routes');
const uploadRoutes = require('../modules/upload/upload.routes');
const callLogsRoutes = require('../modules/callLogs/callLogs.routes');
const mediaRoutes = require('../modules/media/media.routes');
const usersRoutes = require('../modules/users/users.routes');
const branchesRoutes = require('../modules/branches/branches.routes');
const payslipsRoutes = require('../modules/payslips/payslips.routes');
const settingsRoutes = require('../modules/settings/settings.routes');

router.use('/developer', require('../modules/platform/developer.routes'));
router.use('/super-admin', require('../modules/platform/platform.routes'));
router.use('/auth', authRoutes);
router.use('/settings', settingsRoutes);
router.use('/workspace', require('../modules/workspace/workspace.routes'));
router.use('/dashboard', dashboardRoutes);
router.use('/customers', customersRoutes);
router.use('/customer-listings', customerListingsRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/tracking', trackingRoutes);
router.use('/uploads', uploadRoutes);
router.use('/call-logs', callLogsRoutes);
router.use('/media', mediaRoutes);
router.use('/users', usersRoutes);
router.use('/branches', branchesRoutes);
router.use('/payslips', payslipsRoutes);

router.get('/health', (_, res) => {
  res.json({
    success: true,
    message: 'MyStaff Smart API is running',
    data: {
      version: '2.2.0',
      attendanceFaceMode: 'single_photo_only_v2',
      modules: 'rbac,branches,users,customers,listing,calls,attendance,tracking,payslips,settings',
    },
  });
});

module.exports = router;
