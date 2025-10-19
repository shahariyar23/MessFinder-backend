// routes/paymentRoutes.js
import express from 'express';
import {
    initiateSSLCommerzPayment,
    handleSSLIPN,
    validatePayment,
    autoConfirmPayment
} from '../controllers/payment.controller.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/ssl-initiate', authMiddleware, initiateSSLCommerzPayment);
router.post('/ssl-ipn', handleSSLIPN);
router.get('/validate/:transactionId', authMiddleware, validatePayment);
router.post('/auto-confirm', autoConfirmPayment);

export default router;