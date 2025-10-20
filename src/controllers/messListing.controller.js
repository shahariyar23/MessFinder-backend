import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiSuccess from "../utils/ApiSuccess.js";
import MessListing from "../models/messListing.model.js";
import {
    deleteFromCloudinary,
    uploadToCloudinary,
} from "../utils/cloudinary.js";
import mongoose from "mongoose";
import Review from "../models/review.model.js";

const addMess = asyncHandler(async (req, res) => {
    const {
        title,
        description,
        address,
        availableFrom,
        advancePaymentMonth = 1,
        payPerMonth,
        facilities = [],
        roomType,
        roomFeatures,
        genderPreference,
        contact,
        owner_id,
    } = req.body;
    console.log(req.body);
    // Validation checks
    const errors = [];

    if (!title?.trim()) errors.push("Title is required");
    if (!description?.trim()) errors.push("Description is required");
    if (description?.trim().length < 6)
        errors.push("Description must be at least 6 characters");
    if (!address?.trim()) errors.push("Address is required");
    if (!availableFrom) errors.push("Available from date is required");
    if (!payPerMonth) errors.push("Pay per month is required");
    if (!roomType) errors.push("Room type is required");
    if (!roomFeatures) errors.push("Room features are required");
    if (!genderPreference) errors.push("Gender preference is required");
    if (!contact?.trim()) errors.push("Contact information is required");

    // Check if user is owner
    if (req.user.role !== "owner") {
        throw new ApiError(403, "Only owners can create mess listings");
    }

    // Validate images
    if (!req.files || req.files.length !== 3) {
        throw new ApiError(400, "Exactly 3 images are required");
    }

    // Upload each image to Cloudinary
    const imageUploadPromises = req.files.map((file) =>
        uploadToCloudinary(file.path)
    );

    const cloudinaryResults = await Promise.all(imageUploadPromises);

    // Create array of objects with url and public_id
    const images = cloudinaryResults.map((result) => ({
        url: result.secure_url,
        public_id: result.public_id,
    }));

    // Check if all uploads were successful
    const failedUploads = cloudinaryResults.filter((result) => !result);
    if (failedUploads.length > 0) {
        throw new ApiError(500, "Some images failed to upload");
    }

    // Parse facilities
    let facilitiesArray = facilities;
    if (typeof facilities === "string") {
        try {
            facilitiesArray = JSON.parse(facilities);
        } catch (parseError) {
            throw new ApiError(400, "Invalid facilities format");
        }
    }

    // Create new mess listing
    const newMess = new MessListing({
        title: title.trim(),
        description: description.trim(),
        owner_id,
        address: address.trim(),
        availableFrom: new Date(availableFrom),
        advancePaymentMonth: parseInt(advancePaymentMonth) || 1,
        payPerMonth: parseFloat(payPerMonth),
        facilities: facilitiesArray,
        roomType,
        roomFeatures,
        genderPreference,
        contact: contact.trim(),
        image: images, // This will be the array of 3 image paths
        status: "free",
    });

    await newMess.save();

    // Populate owner info
    await newMess.populate("owner_id", "name email phone");

    // Images are successfully saved, DO NOT delete them
    return res
        .status(201)
        .json(
            new ApiSuccess("Mess listing created successfully", newMess, 201)
        );
});

const updateMess = asyncHandler(async (req, res) => {
    const { messId } = req.params;
    const {
        title,
        description,
        address,
        availableFrom,
        advancePaymentMonth = 1,
        payPerMonth,
        facilities = [],
        roomType,
        roomFeatures,
        genderPreference,
        contact
    } = req.body;

    // Check if mess exists
    const existingMess = await MessListing.findById(messId);
    if (!existingMess) {
        throw new ApiError(404, "Mess not found!");
    }

    // Check if user is owner and owns this mess
    if (
        req.user.role !== "owner" ||
        existingMess.owner_id.toString() !== req.user.id
    ) {
        throw new ApiError(
            403,
            "You are not authorized to update this mess listing"
        );
    }

    // Validation checks
    const errors = [];
    if (!title?.trim()) errors.push("Title is required");
    if (!description?.trim()) errors.push("Description is required");
    if (description?.trim().length < 6)
        errors.push("Description must be at least 6 characters");
    if (!address?.trim()) errors.push("Address is required");
    if (!availableFrom) errors.push("Available from date is required");
    if (!payPerMonth) errors.push("Pay per month is required");
    if (!roomType) errors.push("Room type is required");
    if (!roomFeatures) errors.push("Room features are required");
    if (!genderPreference) errors.push("Gender preference is required");
    if (!contact?.trim()) errors.push("Contact information is required");

    if (errors.length > 0) {
        throw new ApiError(400, "Validation failed", errors);
    }

    // Parse facilities if it's a string
    let facilitiesArray = facilities;
    if (typeof facilities === "string") {
        try {
            facilitiesArray = JSON.parse(facilities);
        } catch (parseError) {
            throw new ApiError(400, "Invalid facilities format");
        }
    }

    // Prepare update data
    const updateData = {
        title: title.trim(),
        description: description.trim(),
        address: address.trim(),
        availableFrom: new Date(availableFrom),
        advancePaymentMonth: parseInt(advancePaymentMonth) || 1,
        payPerMonth: parseFloat(payPerMonth),
        facilities: facilitiesArray,
        roomType,
        roomFeatures,
        genderPreference,
        contact: contact.trim(),
        status: existingMess.status,
        updatedAt: new Date(),
    };

    // Update the mess listing
    const updatedMess = await MessListing.findByIdAndUpdate(
        messId,
        { $set: updateData },
        { new: true, runValidators: true }
    ).populate("owner_id", "name email phone");

    if (!updatedMess) {
        throw new ApiError(500, "Failed to update mess listing");
    }

    return res
        .status(200)
        .json(
            new ApiSuccess(
                "Mess listing updated successfully",
                updatedMess,
                200
            )
        );
});

const deleteMess = asyncHandler(async (req, res) => {
    const { messId } = req.params;

    // Find the mess first to check ownership
    const mess = await MessListing.findById(messId);

    if (!mess) {
        throw new ApiError(404, "Mess not found");
    }

    // Check if owner_id exists and then compare
    if (!mess.owner_id) {
        throw new ApiError(400, "Mess owner information is missing");
    }
    // Safe comparison
    if (mess.owner_id && !mess.owner_id.equals(req.user.id)) {
        throw new ApiError(403, "You can only delete your own mess listings");
    }

    // Delete images from Cloudinary
    if (mess.image && mess.image.length > 0) {
        const deletePromises = mess.image.map((img) =>
            deleteFromCloudinary(img.public_id)
        );
        await Promise.all(deletePromises);
    }
    // Delete the mess
    await MessListing.findByIdAndDelete(messId);

    return res.status(200).json(new ApiSuccess("Mess deleted successfully"));
});

const getAllMess = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { minRating, maxRating } = req.query;

    // Build aggregation pipeline
    const pipeline = [
        // Lookup owner information
        {
            $lookup: {
                from: "users",
                localField: "owner_id",
                foreignField: "_id",
                as: "owner_info",
            },
        },
        {
            $unwind: "$owner_info",
        },
        // Filter only active owners
        {
            $match: {
                "owner_info.isActive": true,
            },
        },
        // Add rating filters if provided
        ...(minRating || maxRating
            ? [
                  {
                      $match: {
                          review: {
                              ...(minRating && { $gte: parseFloat(minRating) }),
                              ...(maxRating && { $lte: parseFloat(maxRating) }),
                          },
                      },
                  },
              ]
            : []),
        // Sort and paginate
        {
            $sort: { createdAt: -1 },
        },
        {
            $skip: skip,
        },
        {
            $limit: limit,
        },
        // Project only needed fields
        {
            $project: {
                title: 1,
                description: 1,
                address: 1,
                status: 1,
                availableFrom: 1,
                payPerMonth: 1,
                facilities: 1,
                roomType: 1,
                roomFeatures: 1,
                genderPreference: 1,
                contact: 1,
                image: 1,
                view: 1,
                review: 1,
                createdAt: 1,
                updatedAt: 1,
                owner_id: "$owner_info._id",
                owner_name: "$owner_info.name",
                owner_email: "$owner_info.email",
                owner_phone: "$owner_info.phone",
            },
        },
    ];

    const [allMess, totalMess] = await Promise.all([
        MessListing.aggregate(pipeline),
        MessListing.countDocuments({}), // Get total count for pagination
    ]);

    // Get review counts
    const messIds = allMess.map((mess) => mess._id);
    const reviewStats = await Review.aggregate([
        {
            $match: {
                mess_id: { $in: messIds },
                status: "active",
            },
        },
        {
            $group: {
                _id: "$mess_id",
                totalReviews: { $sum: 1 },
                averageRating: { $avg: "$rating" },
            },
        },
    ]);

    const reviewMap = Object.fromEntries(
        reviewStats.map((stat) => [
            stat._id.toString(),
            {
                totalReviews: stat.totalReviews,
                averageRating: Math.round(stat.averageRating * 10) / 10,
            },
        ])
    );

    const enhancedMess = allMess.map((mess) => ({
        ...mess,
        ratingInfo: {
            totalReviews: reviewMap[mess._id.toString()]?.totalReviews || 0,
            detailedRating: reviewMap[mess._id.toString()]?.averageRating || 0,
        },
    }));

    const totalPages = Math.ceil(totalMess / limit);

    return res.status(200).json(
        new ApiSuccess("Mess listing retrieved successfully", {
            messes: enhancedMess,
            pagination: {
                currentPage: page,
                totalPages,
                totalMess,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        })
    );
});

const messInfoWithView = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, "Invalid mess ID");
    }

    // Get mess details first
    const existingMess = await MessListing.findById(id)
        .populate("owner_id", "name email phone")
        .lean();

    if (!existingMess) {
        throw new ApiError(404, "Mess not found");
    }

    // Check if we need to increment view count
    const shouldIncrementView = existingMess.owner_id._id.toString() !== req.user.id;
    
    let viewCount = existingMess.view || 0;

    if (shouldIncrementView) {
        // Increment view count in database and get the updated value
        const updatedMess = await MessListing.findByIdAndUpdate(
            id, 
            { $inc: { view: 1 } },
            { new: true, select: 'view' } // Only return the view field
        );
        viewCount = updatedMess.view;
    }

    // Execute other operations in parallel
    const [reviewStatsResult, recentReviews] = await Promise.all([
        // Get review statistics
        Review.aggregate([
            {
                $match: {
                    mess_id: new mongoose.Types.ObjectId(id),
                    status: "active",
                },
            },
            {
                $group: {
                    _id: "$mess_id",
                    totalReviews: { $sum: 1 },
                    averageRating: { $avg: "$rating" },
                    ratingDistribution: { $push: "$rating" },
                },
            },
        ]),

        // Get recent reviews
        Review.find({
            mess_id: id,
            status: "active",
        })
            .populate("user_id", "name")
            .sort({ createdAt: -1 })
            .limit(3)
            .lean(),
    ]);

    // Process review statistics
    const reviewStats = reviewStatsResult[0] || {};
    const averageRating = reviewStats.averageRating
        ? Math.round(reviewStats.averageRating * 10) / 10
        : 0;
    const totalReviews = reviewStats.totalReviews || 0;

    // Calculate rating distribution efficiently
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (reviewStats.ratingDistribution) {
        reviewStats.ratingDistribution.forEach((rating) => {
            ratingDistribution[rating]++;
        });
    }

    // Enhanced mess response
    const enhancedMess = {
        ...existingMess,
        view: viewCount, // Use the correct view count
        ratingInfo: {
            averageRating,
            totalReviews,
            ratingDistribution,
            recentReviews: recentReviews.map((review) => ({
                _id: review._id,
                rating: review.rating,
                comment: review.comment,
                createdAt: review.createdAt,
                user: review.user_id,
            })),
        },
    };

    return res
        .status(200)
        .json(new ApiSuccess("Mess retrieved successfully", enhancedMess));
});

const messOnlyNotBook = asyncHandler(async (req, res) => {
    const messes = await MessListing.find({
        status: { $ne: "booked" }, // Not booked
    })
        .populate("owner_id", "name email phone")
        .lean();

    if (!messes || messes.length === 0) {
        throw new ApiError(404, "No available messes found");
    }

    // Get mess IDs for batch review query
    const messIds = messes.map((mess) => mess._id);

    // Get review statistics for all messes
    const reviewStats = await Review.aggregate([
        {
            $match: {
                mess_id: { $in: messIds },
                status: "active",
            },
        },
        {
            $group: {
                _id: "$mess_id",
                totalReviews: { $sum: 1 },
                averageRating: { $avg: "$rating" },
            },
        },
    ]);

    // Create review map for quick lookup
    const reviewMap = {};
    reviewStats.forEach((stat) => {
        reviewMap[stat._id.toString()] = {
            totalReviews: stat.totalReviews,
            averageRating: Math.round(stat.averageRating * 10) / 10,
        };
    });

    // Enhance mess data with review information
    const enhancedMesses = messes.map((mess) => {
        const reviewInfo = reviewMap[mess._id.toString()] || {
            totalReviews: 0,
            averageRating: 0,
        };

        return {
            ...mess,
            ratingInfo: {
                averageRating: reviewInfo.averageRating,
                totalReviews: reviewInfo.totalReviews,
            },
        };
    });

    return res
        .status(200)
        .json(
            new ApiSuccess(
                "Available messes retrieved successfully",
                enhancedMesses
            )
        );
});

const advancedSearchMess = asyncHandler(async (req, res) => {
    const {
        search, // For name/title search
        location, // For location search
        sortBy = "date", // price, date, or rating
        sortOrder = "desc", // asc or desc
        page = 1,
        limit = 10,
    } = req.query;

    const skip = (page - 1) * limit;

    // Build search query
    let query = {};

    if (search || location) {
        query.$or = [];

        if (search) {
            query.$or.push(
                { title: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } }
            );
        }

        if (location) {
            query.$or.push({ address: { $regex: location, $options: "i" } });
        }
    }

    // Build sort options
    let sortOptions = {};

    switch (sortBy) {
        case "price":
            sortOptions.payPerMonth = sortOrder === "asc" ? 1 : -1;
            break;
        case "date":
            sortOptions.createdAt = sortOrder === "asc" ? 1 : -1;
            break;
        case "rating":
            // We'll handle rating sorting after getting reviews
            sortOptions.createdAt = -1; // Temporary default
            break;
        default:
            sortOptions.createdAt = -1;
    }

    // Get review statistics for rating
    const reviewStats = await Review.aggregate([
        {
            $match: { status: "active" },
        },
        {
            $group: {
                _id: "$mess_id",
                averageRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 },
            },
        },
    ]);

    // Create review map
    const reviewMap = new Map();
    reviewStats.forEach((stat) => {
        reviewMap.set(stat._id.toString(), {
            averageRating: Math.round(stat.averageRating * 10) / 10 || 0,
            totalReviews: stat.totalReviews || 0,
        });
    });

    // Execute queries
    const [messes, totalMesses] = await Promise.all([
        MessListing.find(query)
            .populate("owner_id", "name email phone")
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        MessListing.countDocuments(query),
    ]);

    // Enhance mess data with rating information
    const enhancedMesses = messes.map((mess) => {
        const reviewInfo = reviewMap.get(mess._id.toString()) || {
            averageRating: 0,
            totalReviews: 0,
        };

        return {
            ...mess,
            ratingInfo: reviewInfo,
        };
    });

    // Handle rating sorting (if selected)
    if (sortBy === "rating") {
        enhancedMesses.sort((a, b) => {
            return sortOrder === "asc"
                ? a.ratingInfo.averageRating - b.ratingInfo.averageRating
                : b.ratingInfo.averageRating - a.ratingInfo.averageRating;
        });
    }

    const totalPages = Math.ceil(totalMesses / limit);

    return res.status(200).json(
        new ApiSuccess("Messes retrieved successfully", {
            messes: enhancedMesses,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalMesses,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
            filters: {
                search: search || "",
                location: location || "",
                sortBy,
                sortOrder,
            },
        })
    );
});
const withOutSearchSort = asyncHandler(async (req, res) => {
    const {
        sortBy = "price",
        sortOrder = "desc",
        minRating,
        page = 1,
        limit = 10,
    } = req.query;

    const skip = (page - 1) * limit;

    // Get all messes
    let messes = await MessListing.find()
        .populate("owner_id", "name email phone")
        .lean();

    // Get review statistics for all messes
    const messIds = messes.map((mess) => mess._id);
    const reviewStats = await Review.aggregate([
        {
            $match: {
                mess_id: { $in: messIds },
                status: "active",
            },
        },
        {
            $group: {
                _id: "$mess_id",
                totalReviews: { $sum: 1 },
                averageRating: { $avg: "$rating" },
            },
        },
    ]);

    // Create review map
    const reviewMap = {};
    reviewStats.forEach((stat) => {
        reviewMap[stat._id.toString()] = {
            totalReviews: stat.totalReviews,
            averageRating: Math.round(stat.averageRating * 10) / 10,
        };
    });

    // Enhance mess data with review information and filter by rating
    let enhancedMesses = messes.map((mess) => {
        const reviewInfo = reviewMap[mess._id.toString()] || {
            totalReviews: 0,
            averageRating: 0,
        };

        return {
            ...mess,
            ratingInfo: {
                averageRating: reviewInfo.averageRating,
                totalReviews: reviewInfo.totalReviews,
            },
        };
    });

    // Filter by minimum rating if provided
    if (minRating) {
        enhancedMesses = enhancedMesses.filter(
            (mess) => mess.ratingInfo.averageRating >= parseFloat(minRating)
        );
    }

    // Define sort options
    switch (sortBy) {
        case "price":
            enhancedMesses.sort((a, b) =>
                sortOrder === "asc"
                    ? a.payPerMonth - b.payPerMonth
                    : b.payPerMonth - a.payPerMonth
            );
            break;
        case "date":
            enhancedMesses.sort((a, b) =>
                sortOrder === "asc"
                    ? new Date(a.createdAt) - new Date(b.createdAt)
                    : new Date(b.createdAt) - new Date(a.createdAt)
            );
            break;
        case "rating":
            enhancedMesses.sort((a, b) =>
                sortOrder === "asc"
                    ? a.ratingInfo.averageRating - b.ratingInfo.averageRating
                    : b.ratingInfo.averageRating - a.ratingInfo.averageRating
            );
            break;
        default:
            enhancedMesses.sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
            );
    }

    // Apply pagination
    const totalMesses = enhancedMesses.length;
    const paginatedMesses = enhancedMesses.slice(skip, skip + parseInt(limit));

    const totalPages = Math.ceil(totalMesses / limit);

    return res.status(200).json(
        new ApiSuccess("Messes retrieved successfully", {
            messes: paginatedMesses,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalMesses,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
            filters: {
                sortBy,
                sortOrder,
                minRating: minRating || "",
            },
        })
    );
});

export {
    addMess,
    updateMess,
    messInfoWithView,
    messOnlyNotBook,
    getAllMess,
    advancedSearchMess,
    withOutSearchSort,
    deleteMess,
};
