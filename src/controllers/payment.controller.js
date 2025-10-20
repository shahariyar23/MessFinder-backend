// controllers/paymentController.js
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
    console.log("Booking found:", booking);

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
        success_url: `${process.env.FRONTEND_URL}/payment/success?tran_id=${transactionId}`,
        fail_url: `${process.env.FRONTEND_URL}/payment/failed?tran_id=${transactionId}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel?tran_id=${transactionId}`,
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

    console.log("SSL Commerz Payment Data:", {
        transactionId: data.tran_id,
        amount: data.total_amount,
        customer: data.cus_name,
        product: data.product_name,
    });

    const sslcz = new SSLCommerzPayment(
        process.env.SSL_APP_STORE_ID,
        process.env.SSL_APP_PASSWORD,
        process.env.SSL_IS_LIVE === "true" // Convert string to boolean
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

        console.log("Payment initiated successfully:", {
            transactionId: data.tran_id,
            paymentUrl: apiResponse.GatewayPageURL,
        });

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
                            amount:
                                booking.payAbleAmount || booking.totalAmount,
                            transactionId: booking.transactionId,
                            paymentMethod: booking.paymentMethod,
                            paymentDate: booking.paidAt,
                            messName: booking.mess_id?.title,
                            bookingId: booking._id,
                            checkInDate: booking.checkInDate,
                            advanceMonths: booking.advanceMonths,
                            monthlyRent: booking.mess_id?.payPerMonth,
                            roomType: booking.mess_id?.roomType, // Add if available in your model
                        });
                        console.log(
                            "✅ Payment success email sent to:",
                            booking.tenantEmail
                        );
                    } catch (emailError) {
                        console.error(
                            "❌ Failed to send payment success email:",
                            emailError
                        );
                    }
                } catch (error) {
                    await session.abortTransaction();
                    session.endSession();
                    throw error;
                }
            } else {
                console.warn(
                    " Booking not found for transaction:",
                    paymentData.tran_id
                );
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
        console.error(" IPN Processing Error:", error);
        res.status(200).json({
            status: "IPN received but processing failed",
            error: error.message,
        });
    }
});

// Auto-confirm payment for development with mess status update
const autoConfirmPayment = asyncHandler(async (req, res) => {
    const { transactionId } = req.body;

    console.log(" Auto-confirming payment:", transactionId);

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

                console.log(
                    "✅ Auto-confirmed payment and updated mess status:",
                    {
                        transactionId: transactionId,
                        messId: booking.mess_id._id,
                        messStatus: "booked",
                    }
                );

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
                        roomType: booking.mess_id?.roomType, // Add if available in your model
                    });
                    console.log(
                        "✅ Payment success email sent to:",
                        booking.tenantEmail
                    );
                } catch (emailError) {
                    console.error(
                        "❌ Failed to send payment success email:",
                        emailError
                    );
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
        throw new ApiError(
            500,
            "Failed to auto-confirm payment: " + error.message
        );
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
        messStatus: booking.mess_id?.status, // Include mess status in response
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

export {
    initiateSSLCommerzPayment,
    handleSSLIPN,
    validatePayment,
    autoConfirmPayment,
};
