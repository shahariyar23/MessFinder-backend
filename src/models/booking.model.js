import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
    // Essential References
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    mess_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MessListing",
        required: true
    },
    owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // Booking Details
    bookingStatus: {
        type: String,
        enum: ["pending", "confirmed", "cancelled", "completed", "rejected"],
        default: "pending"
    },
    bookingDate: {
        type: Date,
        default: Date.now
    },
    checkInDate: {
        type: Date,
        required: true
    },
   
    // Payment Information - UPDATED
    totalAmount: {
        type: Number,
        min: 0,
        default: 0,
        required: true
    },
    advanceMonths: {
        type: Number,
        default: 1,
        min: 0,
        max: 3
    },
    payAbleAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed", "refunded"],
        default: "pending"
    },
    paymentMethod: {
        type: String,
        enum: ["cash", "card", "bank_transfer", "sslcommerz", "bkash", "nagad", "rocket"], // ADDED NEW METHODS
        default: "cash"
    },
    transactionId: {
        type: String
    },
    
    // ADD THESE NEW FIELDS FOR PAYMENT TRACKING
    paymentInitiatedAt: {
        type: Date
    },
    paidAt: {
        type: Date
    },
    paymentDetails: {
        type: mongoose.Schema.Types.Mixed // To store complete payment gateway response
    },

    // Tenant Information
    tenantName: {
        type: String,
        required: true
    },
    tenantPhone: {
        type: String,
        required: true
    },
    tenantEmail: {
        type: String,
        required: true
    },
    // Additional Requirements
   
    emergencyContact: {
        name: String,
        phone: String,
        relation: String
    }
}, { timestamps: true });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;