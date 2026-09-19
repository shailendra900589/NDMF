const express = require('express');
const router = express.Router();
const users = require('./users.controller');
const { authMiddleware, requireRole } = require('../../middleware/authMiddleware');
const { requirePermission } = require('../../middleware/permissionMiddleware');

router.get('/permission-schema', authMiddleware, users.getPermissionSchema);
router.get('/', authMiddleware, requirePermission('users'), users.getAll);
router.post('/', authMiddleware, requireRole('admin', 'branchManager'), requirePermission('users'), users.create);
router.put('/:id', authMiddleware, requireRole('admin', 'branchManager'), requirePermission('users'), users.update);

module.exports = router;
