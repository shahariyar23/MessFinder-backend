
import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
    initiateSSLCommerzPayment,
    handleSSLIPN,
    validatePayment
} from '../controllers/payment.controller.js';

const router = express.Router();

router.post('/ssl-initiate', authMiddleware, initiateSSLCommerzPayment);
router.post('/ssl-ipn', handleSSLIPN);
router.get('/validate/:transactionId', authMiddleware, validatePayment);

export default router;