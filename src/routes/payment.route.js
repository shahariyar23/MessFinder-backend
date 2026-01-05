import express from "express";
import {
    initiateSSLCommerzPayment,
    handleSSLIPN,
    validatePayment,
    autoConfirmPayment,
    handlePaymentSuccess, // Add this
    handlePaymentFailed, // Add this
    handlePaymentCancel, // Add this
} from "../controllers/payment.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/ssl-initiate", authMiddleware, initiateSSLCommerzPayment);
router.post("/ssl-ipn", handleSSLIPN);
router.get("/validate/:transactionId", authMiddleware, validatePayment);
router.post("/auto-confirm", autoConfirmPayment);

// ✅ ADD THESE NEW ROUTES
router.post("/success", handlePaymentSuccess); // SSLCommerz sends POST here
router.post("/failed", handlePaymentFailed); // SSLCommerz sends POST here
router.post("/cancel", handlePaymentCancel); // SSLCommerz sends POST here

router.get("/success", (_, res) =>
    res.status(405).json({
        success: false,
        message: "This endpoint only accepts POST from SSLCommerz",
    })
);

export default router;
