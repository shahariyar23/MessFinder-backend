import Review from '../models/review.model.js';
import Booking from '../models/booking.model.js';
import MessListing from '../models/messListing.model.js';
import ApiError from '../utils/ApiError.js';
import ApiSuccess from '../utils/ApiSuccess.js';
import asyncHandler from '../utils/asyncHandler.js';
import mongoose from 'mongoose';

// Create a new review
const createReview = asyncHandler(async (req, res) => {
    const {
        mess_id,
        booking_id,
        rating,
        comment
    } = req.body;

    // Validate required fields
    if (!mess_id || !booking_id || !rating || !comment) {
        throw new ApiError(400, "All fields are required");
    }

    // Check if rating is valid
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
        throw new ApiError(400, "Rating must be a whole number between 1 and 5");
    }

    // Check if comment length is valid
    if (comment.trim().length === 0 || comment.length > 1000) {
        throw new ApiError(400, "Comment must be between 1 and 1000 characters");
    }

    // Check if booking exists and belongs to user
    const booking = await Booking.findById(booking_id);
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    // Verify booking ownership
    if (booking.user_id.toString() !== req.user.id.toString()) {
        throw new ApiError(403, "You can only review your own bookings");
    }

    // Check if mess exists
    const mess = await MessListing.findById(mess_id);
    if (!mess) {
        throw new ApiError(404, "Mess not found");
    }

    // Verify booking belongs to this mess
    if (booking.mess_id.toString() !== mess_id) {
        throw new ApiError(400, "Booking does not belong to this mess");
    }

    // Check if user already reviewed this mess
    const existingReview = await Review.findOne({
        user_id: req.user.id,
        mess_id: mess_id
    });

    if (existingReview) {
        throw new ApiError(400, "You have already reviewed this mess");
    }

    // Check if booking is completed or confirmed
    if (booking.bookingStatus !== "completed" && booking.bookingStatus !== "confirmed") {
        throw new ApiError(400, "You can only review completed or confirmed bookings");
    }

    // Create review
    const review = new Review({
        user_id: req.user.id,
        mess_id,
        booking_id,
        rating,
        comment: comment.trim(),
        status: "active"
    });

    await review.save();

    // Update mess average rating
    await updateMessAverageRating(mess_id);

    // Populate for response
    await review.populate('user_id', 'name email');
    await review.populate('mess_id', 'title address');

    return res.status(201).json(
        new ApiSuccess("Review created successfully", review, 201)
    );
});

// Get all reviews for a specific mess
const getMessReviews = asyncHandler(async (req, res) => {
    const { messId } = req.params;
    const { 
        page = 1, 
        limit = 10, 
        rating, 
        sortBy = 'createdAt', 
        sortOrder = 'desc' 
    } = req.query;
    
    const skip = (page - 1) * limit;

    // Validate mess exists
    const mess = await MessListing.findById(messId);
    if (!mess) {
        throw new ApiError(404, "Mess not found");
    }

    let query = { 
        mess_id: messId, 
        status: "active" 
    };

    // Filter by rating if provided
    if (rating && [1, 2, 3, 4, 5].includes(parseInt(rating))) {
        query.rating = parseInt(rating);
    }

    // Sort options
    const sortOptions = {};
    if (sortBy === 'rating') {
        sortOptions.rating = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'createdAt') {
        sortOptions.createdAt = sortOrder === 'asc' ? 1 : -1;
    } else {
        sortOptions.createdAt = -1; // Default sort
    }

    const [reviews, totalReviews] = await Promise.all([
        Review.find(query)
            .populate('user_id', 'name')
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Review.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalReviews / limit);

    return res.status(200).json(
        new ApiSuccess("Reviews retrieved successfully", {
            reviews,
            messDetails: {
                title: mess.title,
                address: mess.address,
                averageRating: mess.review
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalReviews,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            filters: {
                rating: rating || 'all',
                sortBy,
                sortOrder
            }
        })
    );
});

// Get all reviews by the current user
const getUserReviews = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const query = { user_id: req.user.id };

    const [reviews, totalReviews] = await Promise.all([
        Review.find(query)
            .populate('mess_id', 'title address images roomType payPerMonth')
            .populate('booking_id', 'checkInDate bookingStatus')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Review.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalReviews / limit);

    return res.status(200).json(
        new ApiSuccess("Your reviews retrieved successfully", {
            reviews,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalReviews,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        })
    );
});

// Get a single review by ID
const getReviewById = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId)
        .populate('user_id', 'name email')
        .populate('mess_id', 'title address facilities roomType')
        .populate('booking_id', 'checkInDate tenantName');

    if (!review) {
        throw new ApiError(404, "Review not found");
    }

    return res.status(200).json(
        new ApiSuccess("Review retrieved successfully", review)
    );
});

// Update a review
const updateReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;

    // Validate at least one field to update
    if (rating === undefined && comment === undefined) {
        throw new ApiError(400, "At least one field (rating or comment) must be provided");
    }

    const review = await Review.findById(reviewId);
    if (!review) {
        throw new ApiError(404, "Review not found");
    }

    // Check if user owns this review
    if (review.user_id.toString() !== req.user.id.toString()) {
        throw new ApiError(403, "You can only update your own reviews");
    }

    let ratingChanged = false;

    // Update rating if provided
    if (rating !== undefined) {
        if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
            throw new ApiError(400, "Rating must be a whole number between 1 and 5");
        }
        ratingChanged = review.rating !== rating;
        review.rating = rating;
    }

    // Update comment if provided
    if (comment !== undefined) {
        if (comment.trim().length === 0 || comment.length > 1000) {
            throw new ApiError(400, "Comment must be between 1 and 1000 characters");
        }
        review.comment = comment.trim();
    }

    await review.save();

    // Update mess average rating if rating changed
    if (ratingChanged) {
        await updateMessAverageRating(review.mess_id);
    }

    await review.populate('user_id', 'name');
    await review.populate('mess_id', 'title');

    return res.status(200).json(
        new ApiSuccess("Review updated successfully", review)
    );
});

// Delete a review
const deleteReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
        throw new ApiError(404, "Review not found");
    }

    // Check if user owns this review or is admin
    const isOwner = review.user_id.toString() === req.user.id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
        throw new ApiError(403, "You can only delete your own reviews");
    }

    const messId = review.mess_id;
    await Review.findByIdAndDelete(reviewId);

    // Update mess average rating
    await updateMessAverageRating(messId);

    return res.status(200).json(
        new ApiSuccess("Review deleted successfully")
    );
});

// Report a review (for inappropriate content)
const reportReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
        throw new ApiError(404, "Review not found");
    }

    // Users cannot report their own reviews
    if (review.user_id.toString() === req.user.id.toString()) {
        throw new ApiError(400, "You cannot report your own review");
    }

    // Update review status to reported
    review.status = "reported";
    await review.save();

    return res.status(200).json(
        new ApiSuccess("Review reported successfully. It will be reviewed by our team.")
    );
});

// Get review statistics for a mess
const getMessReviewStats = asyncHandler(async (req, res) => {
    const { messId } = req.params;

    // Validate mess exists
    const mess = await MessListing.findById(messId);
    if (!mess) {
        throw new ApiError(404, "Mess not found");
    }

    const stats = await Review.aggregate([
        { 
            $match: { 
                mess_id: new mongoose.Types.ObjectId(messId), 
                status: "active" 
            } 
        },
        {
            $group: {
                _id: "$mess_id",
                totalReviews: { $sum: 1 },
                averageRating: { $avg: "$rating" },
                ratingDistribution: {
                    $push: "$rating"
                }
            }
        }
    ]);

    // Calculate rating distribution
    const ratingDistribution = {
        1: 0, 2: 0, 3: 0, 4: 0, 5: 0
    };

    if (stats.length > 0 && stats[0].ratingDistribution) {
        stats[0].ratingDistribution.forEach(rating => {
            ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
        });
    }

    const result = stats[0] ? {
        totalReviews: stats[0].totalReviews,
        averageRating: Math.round(stats[0].averageRating * 10) / 10 || 0,
        ratingDistribution,
        messDetails: {
            title: mess.title,
            address: mess.address,
            currentRating: mess.review
        }
    } : {
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution,
        messDetails: {
            title: mess.title,
            address: mess.address,
            currentRating: mess.review
        }
    };

    return res.status(200).json(
        new ApiSuccess("Review statistics retrieved successfully", result)
    );
});

// Helper function to update mess average rating
const updateMessAverageRating = async (messId) => {
    try {
        const stats = await Review.aggregate([
            { 
                $match: { 
                    mess_id: new mongoose.Types.ObjectId(messId), 
                    status: "active" 
                } 
            },
            {
                $group: {
                    _id: "$mess_id",
                    averageRating: { $avg: "$rating" },
                    totalReviews: { $sum: 1 }
                }
            }
        ]);

        const updateData = {};
        
        if (stats.length > 0) {
            updateData.review = Math.round(stats[0].averageRating * 10) / 10;
        } else {
            updateData.review = 0;
        }

        await MessListing.findByIdAndUpdate(messId, updateData);

    } catch (error) {
        console.error("Error updating mess average rating:", error);
    }
};

export {
    createReview,
    getMessReviews,
    getUserReviews,
    getReviewById,
    updateReview,
    deleteReview,
    reportReview,
    getMessReviewStats
};