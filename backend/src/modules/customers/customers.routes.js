const express = require('express');
const router = express.Router();
const customers = require('./customers.controller');
const { authMiddleware } = require('../../middleware/authMiddleware');

router.get('/', authMiddleware, customers.getAll);
router.get('/:id', authMiddleware, customers.getById);

module.exports = router;
