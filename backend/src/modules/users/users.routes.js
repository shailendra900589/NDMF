const express = require('express');
const router = express.Router();
const wrap = fn => (req, res, next) => Promise.resolve().then(() => fn(req, res)).catch(next);
const users = require('./users.controller');
const { authMiddleware, requireRole } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

router.get('/permission-schema', authMiddleware, users.getPermissionSchema);
router.get('/me/face-enrollment', authMiddleware, users.getFaceEnrollment);
router.put('/me/face-enrollment', authMiddleware, wrap(users.saveFaceEnrollment));
router.get('/', authMiddleware, requirePermission('users'), users.getAll);
router.post('/', authMiddleware, requireRole('admin', 'branchManager'), requirePermission('users'), users.create);
router.put('/:id', authMiddleware, requireRole('admin', 'branchManager'), requirePermission('users'), wrap(users.update));
router.delete('/:id', authMiddleware, requireRole('admin', 'branchManager'), requirePermission('users'), wrap(users.remove));
router.delete('/:id/face-enrollment', authMiddleware, requireRole('admin', 'branchManager'), requirePermission('users'), wrap(users.resetFaceEnrollment));

module.exports = router;
