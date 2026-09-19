const express = require('express');
const digilockerRoutes = require('../modules/kyc/digilocker.routes');

const router = express.Router();
router.use('/digilocker', digilockerRoutes);
module.exports = router;
