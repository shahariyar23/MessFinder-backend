// controllers/paymentController.js
import SSLCommerzPayment from 'sslcommerz-lts';
import Booking from '../models/booking.model.js';
import ApiSuccess from '../utils/ApiSuccess.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';



// Simple readable format
const generateSimpleTransactionId = (bookingId) => {
    const now = new Date();
    const date = now.toLocaleDateString('en-GB').replace(/\//g, '');
    const time = now.toLocaleTimeString('en-GB', { 
        hour12: false 
    }).replace(/:/g, '').slice(0, 6);
    
    return `BOOKING-${date}-${time}-${bookingId.toString().slice(-6)}`;
};

const initiateSSLCommerzPayment = asyncHandler(async (req, res) => {
    const { bookingId, customerInfo } = req.body;

    const booking = await Booking.findById(bookingId).populate('mess_id');
    console.log('Booking found:', booking);
    
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    // Use the amount from booking instead of hardcoded 100
    const amount = booking.payAbleAmount;
    
    // Generate readable transaction ID
    const transactionId = generateSimpleTransactionId(bookingId);

    const data = {
        total_amount: amount,
        currency: 'BDT',
        tran_id: transactionId,
        success_url: `${process.env.FRONTEND_URL}/payment/success?tran_id=${transactionId}`,
        fail_url: `${process.env.FRONTEND_URL}/payment/failed?tran_id=${transactionId}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel?tran_id=${transactionId}`,
        ipn_url: `${process.env.BACKEND_URL}/api/v1/payment/ssl-ipn`,
        shipping_method: 'NO',
        product_name: `Mess Booking - ${booking.mess_id?.title || 'Unknown Mess'}`,
        product_category: 'Mess Service',
        product_profile: 'service',
        cus_name: customerInfo.name || booking.tenantName,
        cus_email: customerInfo.email || booking.tenantEmail,
        cus_add1: customerInfo.address || booking.mess_id?.address || 'N/A',
        cus_city: customerInfo.city || 'Dhaka',
        cus_postcode: customerInfo.postcode || '1200',
        cus_country: 'Bangladesh',
        cus_phone: customerInfo.phone || booking.tenantPhone || "N/A",
        
        // Additional optional fields for better tracking
        value_a: bookingId, // Store booking ID in custom field
        value_b: 'mess_booking', // Type of service
        value_c: booking.user_id.toString(), // User ID
        value_d: booking.mess_id?._id.toString() || 'unknown' // Mess ID
    };

    console.log('SSL Commerz Payment Data:', {
        transactionId: data.tran_id,
        amount: data.total_amount,
        customer: data.cus_name,
        product: data.product_name
    });

    const sslcz = new SSLCommerzPayment(
        process.env.SSL_APP_STORE_ID,
        process.env.SSL_APP_PASSWORD,
        process.env.SSL_IS_LIVE === 'true' // Convert string to boolean
    );

    try {
        const apiResponse = await sslcz.init(data);
        
        if (!apiResponse.GatewayPageURL) {
            throw new Error('No payment URL received from SSL Commerz');
        }

        // Save transaction info to booking
        booking.paymentMethod = 'sslcommerz';
        booking.transactionId = data.tran_id;
        booking.paymentStatus = 'pending';
        booking.paymentInitiatedAt = new Date();
        await booking.save();

        console.log('Payment initiated successfully:', {
            transactionId: data.tran_id,
            paymentUrl: apiResponse.GatewayPageURL
        });

        return res.status(200).json(
            new ApiSuccess("Payment initiated successfully", {
                paymentUrl: apiResponse.GatewayPageURL,
                transactionId: data.tran_id,
                amount: amount,
                bookingId: booking._id
            })
        );
    } catch (error) {
        console.error('SSL Commerz Initiation Error:', error);
        throw new ApiError(500, "Failed to initiate payment: " + error.message);
    }
});

// Enhanced IPN Handler with better logging
const handleSSLIPN = asyncHandler(async (req, res) => {
    const paymentData = req.body;
    
    console.log('SSL IPN Received:', {
        transactionId: paymentData.tran_id,
        status: paymentData.status,
        amount: paymentData.amount,
        bankTranId: paymentData.bank_tran_id
    });

    try {
        // Validate the payment
        if (paymentData.status === 'VALID') {
            const booking = await Booking.findOne({ transactionId: paymentData.tran_id });
            
            if (booking) {
                booking.paymentStatus = 'paid';
                booking.paymentDetails = paymentData;
                booking.paidAt = new Date();
                
                // If payment is successful, update booking status to confirmed
                if (booking.bookingStatus === 'pending') {
                    booking.bookingStatus = 'confirmed';
                }
                
                await booking.save();

                console.log('Payment verified and booking updated:', {
                    transactionId: paymentData.tran_id,
                    bookingId: booking._id,
                    status: 'paid'
                });

                // You can add email notification or other actions here
            } else {
                console.warn('Booking not found for transaction:', paymentData.tran_id);
            }
        } else if (paymentData.status === 'FAILED') {
            const booking = await Booking.findOne({ transactionId: paymentData.tran_id });
            if (booking) {
                booking.paymentStatus = 'failed';
                booking.paymentDetails = paymentData;
                await booking.save();
                
                console.log('Payment failed:', paymentData.tran_id);
            }
        }

        res.status(200).json({ 
            status: 'IPN processed successfully',
            transactionId: paymentData.tran_id 
        });
    } catch (error) {
        console.error('IPN Processing Error:', error);
        res.status(500).json({ 
            status: 'IPN processing failed',
            error: error.message 
        });
    }
});

// Enhanced Validate Payment with better response
const validatePayment = asyncHandler(async (req, res) => {
    const { transactionId } = req.params;
    
    console.log('Validating payment:', transactionId);
    
    const booking = await Booking.findOne({ transactionId })
        .populate('mess_id', 'title address')
        .populate('user_id', 'name email');

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
        customerName: booking.tenantName,
        paidAt: booking.paidAt
    };

    console.log('Payment validation result:', response);

    return res.status(200).json(
        new ApiSuccess("Payment status retrieved successfully", response)
    );
});

export {
    initiateSSLCommerzPayment,
    handleSSLIPN,
    validatePayment
};