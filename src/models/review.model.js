import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    // Essential References
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    mess_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MessListing",
        required: true,
        index: true
    },
    booking_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        required: true,
        index: true
    },

    // Rating Details
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        validate: {
            validator: Number.isInteger,
            message: 'Rating must be a whole number'
        }
    },
    comment: {
        type: String,
        required: true,
        trim: true,
        maxLength: 1000
    },

    
    // Review Status
    status: {
        type: String,
        enum: ["active", "reported", "removed", "pending"],
        default: "active"
    },

}, { 
    timestamps: true 
});

// Compound indexes for better query performance
reviewSchema.index({ mess_id: 1, createdAt: -1 });
reviewSchema.index({ user_id: 1, mess_id: 1 }, { unique: true }); // One review per user per mess
reviewSchema.index({ rating: 1, status: 1 });


const Review = mongoose.model("Review", reviewSchema);
export default Review;