// controllers/payment.controller.js
import SSLCommerzPayment from "sslcommerz-lts";
import Booking from "../models/booking.model.js";
import Mess from "../models/messListing.model.js";
import ApiSuccess from "../utils/ApiSuccess.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendPaymentSuccess } from "../utils/service/emailService.js";

// Simple readable format
const generateSimpleTransactionId = (bookingId) => {
    const now = new Date();
    const date = now.toLocaleDateString("en-GB").replace(/\//g, "");
    const time = now
        .toLocaleTimeString("en-GB", {
            hour12: false,
        })
        .replace(/:/g, "")
        .slice(0, 6);

    return `BOOKING-${date}-${time}-${bookingId.toString().slice(-6)}`;
};

const initiateSSLCommerzPayment = asyncHandler(async (req, res) => {
    const { bookingId, customerInfo } = req.body;

    const booking = await Booking.findById(bookingId).populate("mess_id");

    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    // Check if mess is already booked
    if (booking.mess_id.status === "booked") {
        throw new ApiError(400, "This mess is already booked");
    }

    // Use the amount from booking instead of hardcoded 100
    const amount = booking.payAbleAmount;

    // Generate readable transaction ID
    const transactionId = generateSimpleTransactionId(bookingId);

    const data = {
        total_amount: amount,
        currency: "BDT",
        tran_id: transactionId,
        
        // ✅ FIXED: Use backend endpoints for callbacks
        success_url: `${process.env.BACKEND_URL}/api/v1/payment/success`,
        fail_url: `${process.env.BACKEND_URL}/api/v1/payment/failed`,
        cancel_url: `${process.env.BACKEND_URL}/api/v1/payment/cancel`,
        ipn_url: `${process.env.BACKEND_URL}/api/v1/payment/ssl-ipn`,
        
        shipping_method: "NO",
        product_name: `Mess Booking - ${booking.mess_id?.title || "Unknown Mess"}`,
        product_category: "Mess Service",
        product_profile: "service",
        cus_name: customerInfo.name || booking.tenantName,
        cus_email: customerInfo.email || booking.tenantEmail,
        cus_add1: customerInfo.address || booking.mess_id?.address || "N/A",
        cus_city: customerInfo.city || "Dhaka",
        cus_postcode: customerInfo.postcode || "1200",
        cus_country: "Bangladesh",
        cus_phone: customerInfo.phone || booking.tenantPhone || "N/A",

        // Additional optional fields for better tracking
        value_a: bookingId, // Store booking ID in custom field
        value_b: "mess_booking", // Type of service
        value_c: booking.user_id.toString(), // User ID
        value_d: booking.mess_id?._id.toString() || "unknown", // Mess ID
    };

    const sslcz = new SSLCommerzPayment(
        process.env.SSL_APP_STORE_ID,
        process.env.SSL_APP_PASSWORD,
        process.env.SSL_IS_LIVE === "true"
    );

    try {
        const apiResponse = await sslcz.init(data);

        if (!apiResponse.GatewayPageURL) {
            throw new Error("No payment URL received from SSL Commerz");
        }

        // Save transaction info to booking
        booking.paymentMethod = "sslcommerz";
        booking.transactionId = data.tran_id;
        booking.paymentStatus = "pending";
        booking.paymentInitiatedAt = new Date();
        await booking.save();

        return res.status(200).json(
            new ApiSuccess("Payment initiated successfully", {
                paymentUrl: apiResponse.GatewayPageURL,
                transactionId: data.tran_id,
                amount: amount,
                bookingId: booking._id,
            })
        );
    } catch (error) {
        console.error("SSL Commerz Initiation Error:", error);
        throw new ApiError(500, "Failed to initiate payment: " + error.message);
    }
});

// Enhanced IPN Handler with mess status update
const handleSSLIPN = asyncHandler(async (req, res) => {
    const paymentData = req.body;

    console.log("SSL IPN Received - Full body:", req.body);

    try {
        // Validate the payment
        if (paymentData.status === "VALID") {
            const booking = await Booking.findOne({
                transactionId: paymentData.tran_id,
            })
                .populate("mess_id")
                .populate("user_id", "name email");

            if (booking) {
                const session = await Booking.startSession();
                session.startTransaction();

                try {
                    // Update booking status
                    booking.paymentStatus = "paid";
                    booking.paymentDetails = paymentData;
                    booking.paidAt = new Date();

                    if (booking.bookingStatus === "pending") {
                        booking.bookingStatus = "confirmed";
                    }

                    await booking.save({ session });

                    // Update mess status to 'booked'
                    const mess = await Mess.findById(booking.mess_id._id);
                    if (mess) {
                        mess.status = "booked";
                        mess.availability = false;
                        mess.lastBookedAt = new Date();
                        await mess.save({ session });
                    }

                    // Commit the transaction
                    await session.commitTransaction();
                    session.endSession();

                    console.log("✅ Payment verified and booking updated:", {
                        transactionId: paymentData.tran_id,
                        bookingId: booking._id,
                        status: "paid",
                        messStatus: "booked",
                    });

                    // ✅ SEND PAYMENT SUCCESS EMAIL
                    try {
                        await sendPaymentSuccess(booking.tenantEmail, {
                            userName: booking.tenantName,
                            customerEmail: booking.tenantEmail,
                            amount: booking.payAbleAmount || booking.totalAmount,
                            transactionId: booking.transactionId,
                            paymentMethod: booking.paymentMethod,
                            paymentDate: booking.paidAt,
                            messName: booking.mess_id?.title,
                            bookingId: booking._id,
                            checkInDate: booking.checkInDate,
                            advanceMonths: booking.advanceMonths,
                            monthlyRent: booking.mess_id?.payPerMonth,
                            roomType: booking.mess_id?.roomType,
                        });
                        console.log("✅ Payment success email sent to:", booking.tenantEmail);
                    } catch (emailError) {
                        console.error("❌ Failed to send payment success email:", emailError);
                    }
                } catch (error) {
                    await session.abortTransaction();
                    session.endSession();
                    throw error;
                }
            } else {
                console.warn("Booking not found for transaction:", paymentData.tran_id);
            }
        } else if (paymentData.status === "FAILED") {
            const booking = await Booking.findOne({
                transactionId: paymentData.tran_id,
            });
            if (booking) {
                booking.paymentStatus = "failed";
                booking.paymentDetails = paymentData;
                await booking.save();

                console.log("💔 Payment failed:", paymentData.tran_id);
            }
        }

        res.status(200).json({
            status: "IPN processed successfully",
            transactionId: paymentData.tran_id,
        });
    } catch (error) {
        console.error("IPN Processing Error:", error);
        res.status(200).json({
            status: "IPN received but processing failed",
            error: error.message,
        });
    }
});

// ✅ NEW: Handle payment success callback from SSLCommerz
const handlePaymentSuccess = asyncHandler(async (req, res) => {
    const paymentData = req.body;
    
    console.log("Payment Success Callback:", paymentData);

    try {
        // Verify the payment with SSLCommerz
        const sslcz = new SSLCommerzPayment(
            process.env.SSL_APP_STORE_ID,
            process.env.SSL_APP_PASSWORD,
            process.env.SSL_IS_LIVE === "true"
        );

        const verification = await sslcz.transactionValidation({
            tran_id: paymentData.tran_id
        });

        if (verification.status === 'VALID') {
            // Update booking status
            const booking = await Booking.findOne({ transactionId: paymentData.tran_id })
                .populate("mess_id")
                .populate("user_id", "name email");

            if (booking) {
                const session = await Booking.startSession();
                session.startTransaction();

                try {
                    // Update booking
                    booking.paymentStatus = "paid";
                    booking.paymentDetails = paymentData;
                    booking.paidAt = new Date();

                    if (booking.bookingStatus === "pending") {
                        booking.bookingStatus = "confirmed";
                    }

                    await booking.save({ session });

                    // Update mess status
                    const mess = await Mess.findById(booking.mess_id._id);
                    if (mess) {
                        mess.status = "booked";
                        mess.availability = false;
                        mess.lastBookedAt = new Date();
                        await mess.save({ session });
                    }

                    await session.commitTransaction();
                    session.endSession();

                    // Send success email
                    try {
                        await sendPaymentSuccess(booking.tenantEmail, {
                            userName: booking.tenantName,
                            customerEmail: booking.tenantEmail,
                            amount: booking.payAbleAmount || booking.totalAmount,
                            transactionId: booking.transactionId,
                            paymentMethod: booking.paymentMethod,
                            paymentDate: booking.paidAt,
                            messName: booking.mess_id?.title,
                            bookingId: booking._id,
                            checkInDate: booking.checkInDate,
                            advanceMonths: booking.advanceMonths,
                            monthlyRent: booking.mess_id?.payPerMonth,
                        });
                        console.log("✅ Payment success email sent to:", booking.tenantEmail);
                    } catch (emailError) {
                        console.error("Failed to send payment success email:", emailError);
                    }
                } catch (error) {
                    await session.abortTransaction();
                    session.endSession();
                    throw error;
                }
            }

            // ✅ Redirect to frontend success page with GET parameters
            res.redirect(`${process.env.FRONTEND_URL}/payment/success?tran_id=${paymentData.tran_id}&status=success&bookingId=${paymentData.value_a}`);
        } else {
            // Payment verification failed
            res.redirect(`${process.env.FRONTEND_URL}/payment/failed?tran_id=${paymentData.tran_id}&reason=verification_failed`);
        }
    } catch (error) {
        console.error("Payment success handler error:", error);
        res.redirect(`${process.env.FRONTEND_URL}/payment/failed?tran_id=${paymentData.tran_id}&reason=server_error`);
    }
});

// ✅ NEW: Handle payment failed callback
const handlePaymentFailed = asyncHandler(async (req, res) => {
    const paymentData = req.body;
    
    console.log("Payment Failed Callback:", paymentData);

    // Update booking status to failed
    const booking = await Booking.findOne({ transactionId: paymentData.tran_id });
    if (booking) {
        booking.paymentStatus = "failed";
        booking.paymentDetails = paymentData;
        await booking.save();
    }

    // Redirect to frontend failed page
    res.redirect(`${process.env.FRONTEND_URL}/payment/failed?tran_id=${paymentData.tran_id}&status=failed`);
});

// ✅ NEW: Handle payment cancellation
const handlePaymentCancel = asyncHandler(async (req, res) => {
    const paymentData = req.body;
    
    console.log("Payment Cancelled:", paymentData);

    // Update booking status to cancelled
    const booking = await Booking.findOne({ transactionId: paymentData.tran_id });
    if (booking) {
        booking.paymentStatus = "cancelled";
        booking.paymentDetails = paymentData;
        await booking.save();
    }

    // Redirect to frontend cancelled page
    res.redirect(`${process.env.FRONTEND_URL}/payment/cancelled?tran_id=${paymentData.tran_id}&status=cancelled`);
});

// Auto-confirm payment for development with mess status update
const autoConfirmPayment = asyncHandler(async (req, res) => {
    const { transactionId } = req.body;

    console.log("Auto-confirming payment:", transactionId);

    try {
        const booking = await Booking.findOne({ transactionId })
            .populate("mess_id")
            .populate("user_id", "name email");

        if (!booking) {
            throw new ApiError(404, "Booking not found");
        }

        if (booking.paymentStatus === "pending" && booking.transactionId) {
            const session = await Booking.startSession();
            session.startTransaction();

            try {
                // Update booking
                booking.paymentStatus = "paid";
                booking.bookingStatus = "confirmed";
                booking.paidAt = new Date();
                booking.paymentDetails = {
                    auto_confirmed: true,
                    confirmed_at: new Date(),
                    reason: "IPN not received - auto confirmed via frontend",
                    tran_id: transactionId,
                    status: "VALID",
                    amount: booking.payAbleAmount,
                    currency: "BDT",
                };

                await booking.save({ session });

                // Update mess status to 'booked'
                const mess = await Mess.findById(booking.mess_id._id);
                if (mess) {
                    mess.status = "booked";
                    mess.availability = false;
                    mess.lastBookedAt = new Date();
                    await mess.save({ session });
                }

                await session.commitTransaction();
                session.endSession();

                console.log("✅ Auto-confirmed payment and updated mess status:", {
                    transactionId: transactionId,
                    messId: booking.mess_id._id,
                    messStatus: "booked",
                });

                // ✅ SEND PAYMENT SUCCESS EMAIL FOR AUTO-CONFIRM
                try {
                    await sendPaymentSuccess(booking.tenantEmail, {
                        userName: booking.tenantName,
                        customerEmail: booking.tenantEmail,
                        amount: booking.payAbleAmount || booking.totalAmount,
                        transactionId: booking.transactionId,
                        paymentMethod: booking.paymentMethod,
                        paymentDate: booking.paidAt,
                        messName: booking.mess_id?.title,
                        bookingId: booking._id,
                        checkInDate: booking.checkInDate,
                        advanceMonths: booking.advanceMonths,
                        monthlyRent: booking.mess_id?.payPerMonth,
                        roomType: booking.mess_id?.roomType,
                    });
                    console.log("✅ Payment success email sent to:", booking.tenantEmail);
                } catch (emailError) {
                    console.error("❌ Failed to send payment success email:", emailError);
                }
            } catch (error) {
                await session.abortTransaction();
                session.endSession();
                throw error;
            }
        }

        return res.status(200).json(
            new ApiSuccess("Payment auto-confirmed", {
                paymentStatus: booking.paymentStatus,
                bookingStatus: booking.bookingStatus,
                transactionId: transactionId,
                messStatus: "booked",
            })
        );
    } catch (error) {
        console.error("Auto-confirm Error:", error);
        throw new ApiError(500, "Failed to auto-confirm payment: " + error.message);
    }
});

// Validate Payment function
const validatePayment = asyncHandler(async (req, res) => {
    const { transactionId } = req.params;

    const booking = await Booking.findOne({ transactionId })
        .populate("mess_id", "title address payPerMonth status")
        .populate("user_id", "name email phone")
        .populate("owner_id", "name phone");

    if (!booking) {
        throw new ApiError(404, "Transaction not found");
    }

    const response = {
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.bookingStatus,
        transactionId: booking.transactionId,
        amount: booking.payAbleAmount || booking.totalAmount,
        bookingId: booking._id,
        messName: booking.mess_id?.title,
        messStatus: booking.mess_id?.status,
        monthlyRent: booking.mess_id?.payPerMonth,
        customerName: booking.tenantName,
        customerEmail: booking.tenantEmail,
        customerPhone: booking.tenantPhone,
        bookingDate: booking.bookingDate,
        checkInDate: booking.checkInDate,
        advanceMonths: booking.advanceMonths,
        paymentMethod: booking.paymentMethod,
        paidAt: booking.paidAt,
    };

    return res
        .status(200)
        .json(
            new ApiSuccess("Payment status retrieved successfully", response)
        );
});

// Get all payments for admin with advanced filtering
const getAllPaymentsAdmin = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can access all payments.");
    }

    const { 
        page = 1, 
        limit = 10, 
        status, 
        paymentMethod, 
        startDate, 
        endDate,
        userId,
        ownerId,
        messId,
        search 
    } = req.query;
    
    const skip = (page - 1) * limit;

    let query = {};

    // Add status filter if provided
    if (status) {
        query.paymentStatus = status;
    }

    // Add payment method filter
    if (paymentMethod) {
        query.paymentMethod = paymentMethod;
    }

    // Add date range filter
    if (startDate || endDate) {
        query.paidAt = {};
        if (startDate) query.paidAt.$gte = new Date(startDate);
        if (endDate) query.paidAt.$lte = new Date(endDate);
    }

    // Add user/owner/mess specific filters
    if (userId) {
        query.user_id = userId;
    }

    if (ownerId) {
        query.owner_id = ownerId;
    }

    if (messId) {
        query.mess_id = messId;
    }

    // Add search functionality
    if (search) {
        query.$or = [
            { transactionId: { $regex: search, $options: 'i' } },
            { 'user_id.name': { $regex: search, $options: 'i' } },
            { 'user_id.email': { $regex: search, $options: 'i' } },
            { 'owner_id.name': { $regex: search, $options: 'i' } },
            { 'mess_id.title': { $regex: search, $options: 'i' } },
            { tenantName: { $regex: search, $options: 'i' } },
            { tenantEmail: { $regex: search, $options: 'i' } }
        ];
    }

    const [payments, totalPayments] = await Promise.all([
        Booking.find(query)
            .populate("user_id", "name email phone")
            .populate("owner_id", "name email phone")
            .populate("mess_id", "title address payPerMonth")
            .sort({ paidAt: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Booking.countDocuments(query),
    ]);

    // Get payment statistics
    const paymentStats = await Booking.aggregate([
        { $match: query },
        {
            $group: {
                _id: "$paymentStatus",
                count: { $sum: 1 },
                totalAmount: { $sum: "$payAbleAmount" }
            }
        }
    ]);

    // Get total revenue
    const revenueStats = await Booking.aggregate([
        { 
            $match: { 
                ...query, 
                paymentStatus: "paid" 
            } 
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: "$payAbleAmount" },
                totalBookings: { $sum: 1 },
                averageAmount: { $avg: "$payAbleAmount" }
            }
        }
    ]);

    // Get payment method distribution
    const methodStats = await Booking.aggregate([
        { 
            $match: { 
                ...query, 
                paymentStatus: "paid" 
            } 
        },
        {
            $group: {
                _id: "$paymentMethod",
                count: { $sum: 1 },
                totalAmount: { $sum: "$payAbleAmount" }
            }
        }
    ]);

    const totalPages = Math.ceil(totalPayments / limit);
    const revenueData = revenueStats[0] || { totalRevenue: 0, totalBookings: 0, averageAmount: 0 };

    // Convert stats to objects
    const statusCounts = {};
    paymentStats.forEach(item => {
        statusCounts[item._id] = {
            count: item.count,
            amount: item.totalAmount
        };
    });

    const methodDistribution = {};
    methodStats.forEach(item => {
        methodDistribution[item._id] = {
            count: item.count,
            amount: item.totalAmount
        };
    });

    return res.status(200).json(
        new ApiSuccess("All payments retrieved successfully", {
            payments: payments.map(payment => ({
                _id: payment._id,
                transactionId: payment.transactionId,
                amount: payment.payAbleAmount,
                paymentStatus: payment.paymentStatus,
                paymentMethod: payment.paymentMethod,
                paidAt: payment.paidAt,
                bookingStatus: payment.bookingStatus,
                user: payment.user_id,
                owner: payment.owner_id,
                mess: payment.mess_id,
                tenantName: payment.tenantName,
                tenantEmail: payment.tenantEmail,
                checkInDate: payment.checkInDate,
                advanceMonths: payment.advanceMonths
            })),
            statistics: {
                statusCounts,
                methodDistribution,
                revenue: revenueData,
                totalPayments
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalPayments,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
            filters: {
                status,
                paymentMethod,
                startDate,
                endDate,
                userId,
                ownerId,
                messId,
                search
            }
        })
    );
});

// Get payment statistics for admin dashboard
const getPaymentStatistics = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can access payment statistics.");
    }

    const { period = "month" } = req.query;
    const currentDate = new Date();
    let startDate;

    switch (period) {
        case "week":
            startDate = new Date(currentDate.setDate(currentDate.getDate() - 7));
            break;
        case "month":
            startDate = new Date(currentDate.setMonth(currentDate.getMonth() - 1));
            break;
        case "year":
            startDate = new Date(currentDate.setFullYear(currentDate.getFullYear() - 1));
            break;
        default:
            startDate = new Date(currentDate.setMonth(currentDate.getMonth() - 1));
    }

    // Get payment trends
    const paymentTrends = await Booking.aggregate([
        {
            $match: {
                paidAt: { $gte: startDate },
                paymentStatus: "paid"
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: "$paidAt" },
                    month: { $month: "$paidAt" },
                    day: { $dayOfMonth: "$paidAt" }
                },
                count: { $sum: 1 },
                revenue: { $sum: "$payAbleAmount" },
                averageAmount: { $avg: "$payAbleAmount" }
            }
        },
        {
            $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
        }
    ]);

    // Get top performing messes by revenue
    const topMesses = await Booking.aggregate([
        {
            $match: { 
                paymentStatus: "paid",
                paidAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: "$mess_id",
                bookingCount: { $sum: 1 },
                totalRevenue: { $sum: "$payAbleAmount" },
                averageRevenue: { $avg: "$payAbleAmount" }
            }
        },
        {
            $sort: { totalRevenue: -1 }
        },
        {
            $limit: 10
        },
        {
            $lookup: {
                from: "messlistings",
                localField: "_id",
                foreignField: "_id",
                as: "messDetails"
            }
        },
        {
            $unwind: "$messDetails"
        }
    ]);

    // Get recent payments for activity feed
    const recentPayments = await Booking.find({ 
        paymentStatus: "paid" 
    })
        .populate("user_id", "name email")
        .populate("mess_id", "title")
        .sort({ paidAt: -1 })
        .limit(10)
        .select("transactionId payAbleAmount paidAt tenantName paymentMethod")
        .lean();

    return res.status(200).json(
        new ApiSuccess("Payment statistics retrieved successfully", {
            trends: paymentTrends,
            topMesses,
            recentPayments,
            period,
            dateRange: {
                start: startDate,
                end: new Date()
            }
        })
    );
});

// Update payment status (admin only)
const updatePaymentStatus = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can update payment status.");
    }

    const { bookingId } = req.params;
    const { paymentStatus, adminNotes } = req.body;

    const validStatuses = ["pending", "paid", "failed", "refunded"];
    if (!validStatuses.includes(paymentStatus)) {
        throw new ApiError(400, "Invalid payment status");
    }

    const booking = await Booking.findById(bookingId)
        .populate("mess_id")
        .populate("user_id", "name email");

    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    const session = await Booking.startSession();
    session.startTransaction();

    try {
        const oldStatus = booking.paymentStatus;
        booking.paymentStatus = paymentStatus;
        
        if (adminNotes) {
            booking.adminNotes = adminNotes;
        }

        // If marking as paid, update related statuses
        if (paymentStatus === "paid" && oldStatus !== "paid") {
            booking.paidAt = new Date();
            if (booking.bookingStatus === "pending") {
                booking.bookingStatus = "confirmed";
            }

            // Update mess status
            if (booking.mess_id) {
                booking.mess_id.status = "booked";
                booking.mess_id.availability = false;
                await booking.mess_id.save({ session });
            }

            // Send payment success email
            try {
                await sendPaymentSuccess(booking.tenantEmail, {
                    userName: booking.tenantName,
                    customerEmail: booking.tenantEmail,
                    amount: booking.payAbleAmount || booking.totalAmount,
                    transactionId: booking.transactionId,
                    paymentMethod: booking.paymentMethod,
                    paymentDate: booking.paidAt,
                    messName: booking.mess_id?.title,
                    bookingId: booking._id,
                    checkInDate: booking.checkInDate,
                    advanceMonths: booking.advanceMonths,
                    monthlyRent: booking.mess_id?.payPerMonth,
                });
            } catch (emailError) {
                console.error("Failed to send payment success email:", emailError);
            }
        }

        await booking.save({ session });
        await session.commitTransaction();
        session.endSession();

        return res.status(200).json(
            new ApiSuccess("Payment status updated successfully", booking)
        );

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
});

// Refund payment (admin only)
const refundPayment = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can process refunds.");
    }

    const { bookingId } = req.params;
    const { refundAmount, reason } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    if (booking.paymentStatus !== "paid") {
        throw new ApiError(400, "Only paid payments can be refunded");
    }

    const refundAmt = refundAmount || booking.payAbleAmount;

    // Update booking status
    booking.paymentStatus = "refunded";
    booking.refundAmount = refundAmt;
    booking.refundReason = reason;
    booking.refundedAt = new Date();
    booking.refundedBy = req.user.id;

    // Update mess status if needed
    if (booking.mess_id) {
        const mess = await Mess.findById(booking.mess_id);
        if (mess) {
            mess.status = "free";
            mess.availability = true;
            await mess.save();
        }
    }

    await booking.save();

    return res.status(200).json(
        new ApiSuccess("Payment refunded successfully", {
            bookingId: booking._id,
            refundAmount: refundAmt,
            originalAmount: booking.payAbleAmount,
            reason: reason
        })
    );
});

export {
    initiateSSLCommerzPayment,
    handleSSLIPN,
    validatePayment,
    autoConfirmPayment,
    handlePaymentSuccess,  // ✅ NEW
    handlePaymentFailed,   // ✅ NEW  
    handlePaymentCancel,   // ✅ NEW
    getAllPaymentsAdmin,
    getPaymentStatistics,
    updatePaymentStatus,
    refundPayment
};