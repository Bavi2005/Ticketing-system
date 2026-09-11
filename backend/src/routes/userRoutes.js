const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { auth } = require('../middleware/auth');
const userController = require('../controllers/userController');
const validate = require('../middleware/validate');
const { updateProfileSchema, uploadReceiptSchema } = require('../validators/schemas');
const { upload } = require('../utils/upload');
const config = require('../config');

const uploadLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.NODE_ENV === 'test',
  message: { message: 'Too many uploads. Please try again later.' },
});

router.use(auth);

router.get('/dashboard', userController.getDashboard);
router.get('/receipts', userController.getReceipts);
router.get('/vouchers', userController.getVouchers);
router.post('/vouchers/:id/redeem', userController.redeemVoucher);
router.put('/profile', validate(updateProfileSchema), userController.updateProfile);
router.post('/receipts', uploadLimiter, upload.single('receipt'), validate(uploadReceiptSchema), userController.uploadReceipt);

module.exports = router;