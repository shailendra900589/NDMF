const express = require('express');
const router = express.Router();
const customers = require('./customers.controller');
const { authMiddleware } = require('../../middleware/authMiddleware');

router.get('/', authMiddleware, customers.getAll);
router.post('/', authMiddleware, customers.create);
router.post('/:id/reverify', authMiddleware, (req,res,next) => customers.reverify(req,res).catch(next));
router.get('/:id', authMiddleware, customers.getById);

module.exports = router;
