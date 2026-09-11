const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { adminAuth } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const validate = require('../middleware/validate');
const { adminLoginSchema } = require('../validators/schemas');
const authController = require('../controllers/authController');
const config = require('../config');

const authLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  limit: config.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
  message: { message: 'Too many attempts. Please try again later.' },
});

router.post('/login', authLimiter, validate(adminLoginSchema), authController.adminLogin);
router.get('/me', adminAuth, authController.adminMe);

router.use(adminAuth);

router.get('/dashboard', adminController.getDashboard);
router.get('/receipts', adminController.getReceipts);
router.post('/receipts/:id/approve', adminController.approveReceipt);
router.post('/receipts/:id/reject', adminController.rejectReceipt);

module.exports = router;