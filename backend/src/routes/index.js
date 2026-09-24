/**
 * MAIN ROUTES — production API
 */
const express = require('express');
const router = express.Router();

const authRoutes = require('../modules/auth/auth.routes');
const dashboardRoutes = require('../modules/dashboard/dashboard.routes');
const customersRoutes = require('../modules/customers/customers.routes');
const attendanceRoutes = require('../modules/attendance/attendance.routes');
const trackingRoutes = require('../modules/tracking/tracking.routes');
const uploadRoutes = require('../modules/upload/upload.routes');
const callLogsRoutes = require('../modules/callLogs/callLogs.routes');
const mediaRoutes = require('../modules/media/media.routes');
const usersRoutes = require('../modules/users/users.routes');
const branchesRoutes = require('../modules/branches/branches.routes');
const payslipsRoutes = require('../modules/payslips/payslips.routes');

router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/customers', customersRoutes);
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
    message: 'NDFA API is running',
    data: {
      version: '2.2.0',
      modules: 'rbac,branches,users,customers,calls,attendance,tracking,payslips',
    },
  });
});

module.exports = router;
