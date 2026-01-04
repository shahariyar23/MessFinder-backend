import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiSuccess from "../utils/ApiSuccess.js";
import MessListing from "../models/messListing.model.js";
import fs from "fs"
import {
    deleteFromCloudinary,
    uploadToCloudinary,
} from "../utils/cloudinary.js";
import mongoose from "mongoose";
import Review from "../models/review.model.js";
import User from "../models/user.model.js";

const addMess = asyncHandler(async (req, res) => {
    // Store reference to uploaded files for cleanup
    const uploadedFiles = req.files || [];
    let cloudinaryPublicIds = []; // To track uploaded cloudinary images for cleanup

    try {
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
        } = req.body;
        const user = await User.findById(req.user.id)
        if(user.isActive !== true){
            throw new ApiError(400, `${user.name} is suspended. Your are not adding any mess`)
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
            //console.log("Validation errors:", errors);
            throw new ApiError(400, errors.join(", "));
        }

        // Check if user is owner
        if (req.user.role !== "owner") {
            //console.log("User is not owner, role:", req.user.role);
            throw new ApiError(403, "Only owners can create mess listings");
        }

        // Validate images
        if (!req.files || req.files.length === 0) {
            //console.log("No files received");
            throw new ApiError(400, "At least one image is required");
        }

        if (req.files.length !== 3) {
            //console.log(`Expected 3 files, got ${req.files.length}`);
            throw new ApiError(400, "Exactly 3 images are required");
        }

        // Check if files are valid images
        const invalidFiles = req.files.filter(file => !file.mimetype.startsWith('image/'));
        if (invalidFiles.length > 0) {
            //console.log("Invalid files detected:", invalidFiles);
            throw new ApiError(400, "Only image files are allowed");
        }

        //console.log("Uploading images to Cloudinary...");

        // Upload each image to Cloudinary
        const imageUploadPromises = req.files.map((file) => {
            //console.log(`Uploading file: ${file.path}`);
            return uploadToCloudinary(file.path);
        });

        const cloudinaryResults = await Promise.all(imageUploadPromises);
        //console.log("Cloudinary results:", cloudinaryResults);

        // Check for failed uploads
        const failedUploads = cloudinaryResults.filter((result) => !result || !result.secure_url);
        if (failedUploads.length > 0) {
            //console.log("Failed uploads:", failedUploads);
            throw new ApiError(500, "Some images failed to upload to Cloudinary");
        }

        // Extract public_ids for cleanup
        cloudinaryPublicIds = cloudinaryResults.map(result => result.public_id);

        // Create array of objects with url and public_id
        const images = cloudinaryResults.map((result) => ({
            url: result.secure_url,
            public_id: result.public_id,
        }));

        //console.log("Uploaded images:", images);

        // Parse facilities if it's a string
        let facilitiesArray = facilities;
        if (typeof facilities === "string") {
            try {
                facilitiesArray = JSON.parse(facilities);
            } catch (parseError) {
                //console.log("Facilities parse error, using as array:", facilities);
                facilitiesArray = Array.isArray(facilities) ? facilities : [facilities];
            }
        }

        // Ensure facilities is an array
        if (!Array.isArray(facilitiesArray)) {
            facilitiesArray = [facilitiesArray];
        }

        // Parse roomFeatures if it's a string
        let roomFeaturesArray = roomFeatures;
        if (typeof roomFeatures === "string") {
            try {
                roomFeaturesArray = JSON.parse(roomFeatures);
            } catch (parseError) {
                //console.log("Room features parse error, using as array:", roomFeatures);
                roomFeaturesArray = Array.isArray(roomFeatures) ? roomFeatures : [roomFeatures];
            }
        }

        // Ensure roomFeatures is an array
        if (!Array.isArray(roomFeaturesArray)) {
            roomFeaturesArray = [roomFeaturesArray];
        }

        //console.log("Creating new mess listing...");

        // Create new mess listing
        const newMess = new MessListing({
            title: title.trim(),
            description: description.trim(),
            owner_id: req.user.id,
            address: address.trim(),
            availableFrom: new Date(availableFrom),
            advancePaymentMonth: parseInt(advancePaymentMonth) || 1,
            payPerMonth: parseFloat(payPerMonth),
            facilities: facilitiesArray,
            roomType,
            roomFeatures: roomFeaturesArray,
            genderPreference,
            contact: contact.trim(),
            image: images,
            status: "free",
        });

        //console.log("Saving to database...");
        await newMess.save();
        //console.log("Saved successfully, ID:", newMess._id);

        // Populate owner info
        await newMess.populate("owner_id", "name email phone");
        //console.log("Populated owner info");

        // Clean up uploaded files from server after successful operation
        req.files.forEach(file => {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
                //console.log("Cleaned up file:", file.path);
            }
        });

        //console.log("Sending success response...");
        return res.status(201).json(
            new ApiSuccess("Mess listing created successfully", newMess, 201)
        );

    } catch (error) {
        // Cleanup procedure on error
        try {
            // Clean up uploaded files from server
            uploadedFiles.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                    console.log("Cleaned up file on error:", file.path);
                }
            });

            // Clean up Cloudinary images if any were uploaded
            if (cloudinaryPublicIds.length > 0) {
                console.log("Cleaning up Cloudinary images on error:", cloudinaryPublicIds);
                const deletePromises = cloudinaryPublicIds.map(publicId => {
                    return new Promise((resolve) => {
                        cloudinary.uploader.destroy(publicId, (error, result) => {
                            if (error) {
                                console.error(`Failed to delete Cloudinary image ${publicId}:`, error);
                            } else {
                                console.log(`✅ Cleaned up Cloudinary image: ${publicId}`);
                            }
                            resolve();
                        });
                    });
                });
                await Promise.all(deletePromises);
            }
        } catch (cleanupError) {
            console.error("Error during cleanup:", cleanupError);
        }

        // Re-throw the original error to maintain existing response behavior
        throw error;
    }
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
        contact,
    } = req.body?.updateData;
    //console.log(req.body);

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
        title: title !== undefined ? title.trim() : existingMess.title,
        description:
            description !== undefined
                ? description.trim()
                : existingMess.description,
        address: address !== undefined ? address.trim() : existingMess.address,
        availableFrom:
            availableFrom !== undefined
                ? new Date(availableFrom)
                : new Date(existingMess.availableFrom),
        advancePaymentMonth:
            advancePaymentMonth !== undefined
                ? parseInt(advancePaymentMonth)
                : parseInt(existingMess.advancePaymentMonth),
        payPerMonth:
            payPerMonth !== undefined ? payPerMonth : existingMess.payPerMonth,
        facilities:
            facilitiesArray !== undefined
                ? facilitiesArray
                : existingMess.facilities,
        roomType: roomType !== undefined ? roomType : existingMess.roomType,
        roomFeatures:
            roomFeatures !== undefined
                ? roomFeatures
                : existingMess.roomFeatures,
        genderPreference:
            genderPreference !== undefined
                ? genderPreference
                : existingMess.genderPreference,
        contact: contact !== undefined ? contact.trim() : existingMess.contact,
        status: existingMess.status, // Keep existing status unless explicitly changed
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
    const { messId, adminId } = req.params;
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

    // Always set status to "free"
    const queryStatus = "free";

    // STEP 1: First find all messes with status "free" using find()
    const baseQuery = {
        status: queryStatus
    };

    // Get total count of free messes
    const totalMess = await MessListing.countDocuments({status: "free"});
    const totalMessForHome = await MessListing.countDocuments();
    // STEP 2: Find free messes with pagination
    const freeMesses = await MessListing.find({status: "free"})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('owner_id', 'name email phone isActive') // Populate owner info
        .lean();

    //console.log(`✅ Found ${freeMesses.length} messes with status: ${queryStatus}`);

    // Debug: Check status of returned messes
    freeMesses.forEach((mess, index) => {
        //console.log(`📦 Mess ${index + 1}: ID=${mess._id}, Status=${mess.status}, Title=${mess.title}`);
    });

    // STEP 3: Filter out messes where owner is not active
    const activeOwnerMesses = freeMesses.filter(mess => 
        mess.owner_id && mess.owner_id.isActive === true
    );

    //console.log(`👤 After owner filter: ${activeOwnerMesses.length} messes`);

    // STEP 4: Get rating information for the filtered messes
    let enhancedMess = [];
    if (activeOwnerMesses.length > 0) {
        const messIds = activeOwnerMesses.map((mess) => mess._id);
        
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
                    averageRating: stat.averageRating ? Math.round(stat.averageRating * 10) / 10 : 0,
                },
            ])
        );

        // STEP 5: Apply rating filter and enhance mess data
        enhancedMess = activeOwnerMesses
            .map((mess) => {
                const ratingInfo = {
                    totalReviews: reviewMap[mess._id.toString()]?.totalReviews || 0,
                    detailedRating: reviewMap[mess._id.toString()]?.averageRating || 0,
                };

                return {
                    _id: mess._id,
                    title: mess.title,
                    description: mess.description,
                    address: mess.address,
                    status: mess.status,
                    availableFrom: mess.availableFrom,
                    payPerMonth: mess.payPerMonth,
                    facilities: mess.facilities,
                    roomType: mess.roomType,
                    roomFeatures: mess.roomFeatures,
                    genderPreference: mess.genderPreference,
                    contact: mess.contact,
                    image: mess.image,
                    view: mess.view,
                    createdAt: mess.createdAt,
                    updatedAt: mess.updatedAt,
                    owner_id: mess.owner_id._id,
                    owner_name: mess.owner_id.name,
                    owner_email: mess.owner_id.email,
                    owner_phone: mess.owner_id.phone,
                    ratingInfo: ratingInfo
                };
            })
            .filter(mess => {
                // Apply rating filters if provided
                if (minRating && mess.ratingInfo.detailedRating < parseFloat(minRating)) {
                    return false;
                }
                if (maxRating && mess.ratingInfo.detailedRating > parseFloat(maxRating)) {
                    return false;
                }
                return true;
            });
    }

    // STEP 6: Calculate pagination for the final filtered results
    const totalPages = Math.ceil(totalMess / limit);
    const finalCount = enhancedMess.length;

    return res.status(200).json(
        new ApiSuccess("Mess listing retrieved successfully", {
            messes: enhancedMess,
            totalMessForHome,
            pagination: {
                currentPage: page,
                totalPages,
                totalMess: finalCount, // Final count after all filters
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
            filters: {
                status: queryStatus,
                minRating: minRating || null,
                maxRating: maxRating || null
            }
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
    const shouldIncrementView =
        existingMess.owner_id._id.toString() !== req.user.id;

    let viewCount = existingMess.view || 0;

    if (shouldIncrementView) {
        // Increment view count in database and get the updated value
        const updatedMess = await MessListing.findByIdAndUpdate(
            id,
            { $inc: { view: 1 } },
            { new: true, select: "view" } // Only return the view field
        );
        viewCount = updatedMess.view;
    }

    // Get all messes owned by the same owner
    const ownerMessIds = await MessListing.find({ 
        owner_id: existingMess.owner_id._id 
    }).select('_id').lean();

    const ownerMessIdsArray = ownerMessIds.map(mess => mess._id);

    // Execute other operations in parallel
    const [reviewStatsResult, recentReviews, individualMessReviewStats] = await Promise.all([
        // Get review statistics for ALL messes of this owner
        Review.aggregate([
            {
                $match: {
                    mess_id: { $in: ownerMessIdsArray },
                    status: "active",
                },
            },
            {
                $group: {
                    _id: null, // Group all reviews together
                    totalReviews: { $sum: 1 },
                    averageRating: { $avg: "$rating" },
                    ratingDistribution: { $push: "$rating" },
                    // Also get per-mess stats for additional info
                    messBreakdown: {
                        $push: {
                            mess_id: "$mess_id",
                            rating: "$rating"
                        }
                    }
                },
            },
        ]),

        // Get recent reviews for ALL messes of this owner
        Review.find({
            mess_id: { $in: ownerMessIdsArray },
            status: "active",
        })
            .populate("user_id", "name")
            .populate("mess_id", "title") // Include mess title to show which mess was reviewed
            .sort({ createdAt: -1 })
            .limit(5) // Increased limit since we're showing reviews from all messes
            .lean(),

        // Get individual mess review stats for this specific mess
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
    ]);

    // Process owner-wide review statistics
    const ownerReviewStats = reviewStatsResult[0] || {};
    const ownerAverageRating = ownerReviewStats.averageRating
        ? Math.round(ownerReviewStats.averageRating * 10) / 10
        : 0;
    const ownerTotalReviews = ownerReviewStats.totalReviews || 0;

    // Process individual mess review statistics
    const individualStats = individualMessReviewStats[0] || {};
    const individualAverageRating = individualStats.averageRating
        ? Math.round(individualStats.averageRating * 10) / 10
        : 0;
    const individualTotalReviews = individualStats.totalReviews || 0;

    // Calculate rating distribution for owner's all messes
    const ownerRatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (ownerReviewStats.ratingDistribution) {
        ownerReviewStats.ratingDistribution.forEach((rating) => {
            ownerRatingDistribution[rating]++;
        });
    }

    // Calculate rating distribution for individual mess
    const individualRatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (individualStats.ratingDistribution) {
        individualStats.ratingDistribution.forEach((rating) => {
            individualRatingDistribution[rating]++;
        });
    }

    // Get total mess count for this owner
    const totalMessesByOwner = ownerMessIdsArray.length;

    // Enhanced mess response
    const enhancedMess = {
        ...existingMess,
        view: viewCount,
        ratingInfo: {
            // Owner-wide statistics (across all messes)
            ownerWideStats: {
                averageRating: ownerAverageRating,
                totalReviews: ownerTotalReviews,
                ratingDistribution: ownerRatingDistribution,
                totalMesses: totalMessesByOwner,
                message: `Based on ${ownerTotalReviews} reviews across ${totalMessesByOwner} mess${totalMessesByOwner > 1 ? 'es' : ''}`
            },
            // Individual mess statistics
            individualMessStats: {
                averageRating: individualAverageRating,
                totalReviews: individualTotalReviews,
                ratingDistribution: individualRatingDistribution,
                message: individualTotalReviews > 0 
                    ? `Based on ${individualTotalReviews} review${individualTotalReviews > 1 ? 's' : ''} for this mess`
                    : 'No reviews yet for this specific mess'
            },
            // Recent reviews from all messes of this owner
            recentReviews: recentReviews.map((review) => ({
                _id: review._id,
                rating: review.rating,
                comment: review.comment,
                createdAt: review.createdAt,
                user: review.user_id,
                mess: {
                    _id: review.mess_id._id,
                    title: review.mess_id.title
                }
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

    // STEP 1: First build base query with ONLY free status messes
    let query = { status: "free" }; // Always filter by free status first

    // STEP 2: Then add search conditions for free messes only
    if (search || location) {
        query.$and = [
            { status: "free" }, // Ensure status remains free
        ];

        if (search || location) {
            query.$and.push({
                $or: []
            });
        }

        if (search) {
            query.$and[1].$or.push(
                { title: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } }
            );
        }

        if (location) {
            query.$and[1].$or.push({ address: { $regex: location, $options: "i" } });
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
            sortOptions.createdAt = -1; // Will sort after aggregation
            break;
        default:
            sortOptions.createdAt = -1;
    }

    // STEP 3: Get all free messes first
    const freeMesses = await MessListing.find({ status: "free" })
        .populate("owner_id", "name email phone isActive")
        .lean();

    // Get all owner IDs from free messes
    const ownerIds = [...new Set(freeMesses.map(mess => mess.owner_id?._id.toString()).filter(Boolean))];

    // STEP 4: Get owner-wide review statistics
    const ownerReviewStats = await Review.aggregate([
        {
            $match: { 
                status: "active",
                mess_id: { 
                    $in: freeMesses.map(mess => mess._id) 
                }
            },
        },
        {
            $lookup: {
                from: "messlistings",
                localField: "mess_id",
                foreignField: "_id",
                as: "mess_info"
            }
        },
        {
            $unwind: "$mess_info"
        },
        {
            $group: {
                _id: "$mess_info.owner_id", // Group by owner instead of mess
                averageRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 },
                totalMesses: { $addToSet: "$mess_id" }, // Count unique messes
                ratingDistribution: { $push: "$rating" }
            },
        },
    ]);

    // Create owner review map
    const ownerReviewMap = new Map();
    ownerReviewStats.forEach((stat) => {
        ownerReviewMap.set(stat._id.toString(), {
            averageRating: Math.round(stat.averageRating * 10) / 10 || 0,
            totalReviews: stat.totalReviews || 0,
            totalMesses: stat.totalMesses?.length || 0,
            ratingDistribution: stat.ratingDistribution || []
        });
    });

    // STEP 5: Get individual mess review statistics for comparison
    const individualReviewStats = await Review.aggregate([
        {
            $match: { 
                status: "active",
                mess_id: { $in: freeMesses.map(mess => mess._id) }
            },
        },
        {
            $group: {
                _id: "$mess_id",
                averageRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 },
            },
        },
    ]);

    // Create individual mess review map
    const individualReviewMap = new Map();
    individualReviewStats.forEach((stat) => {
        individualReviewMap.set(stat._id.toString(), {
            averageRating: Math.round(stat.averageRating * 10) / 10 || 0,
            totalReviews: stat.totalReviews || 0,
        });
    });

    // STEP 6: Apply search filters to free messes
    let filteredMesses = freeMesses.filter(mess => {
        // Filter by active owner
        if (!mess.owner_id || mess.owner_id.isActive !== true) {
            return false;
        }

        // Apply search filters
        if (search || location) {
            const searchTerm = search?.toLowerCase();
            const locationTerm = location?.toLowerCase();
            
            const matchesSearch = !searchTerm || 
                mess.title?.toLowerCase().includes(searchTerm) ||
                mess.description?.toLowerCase().includes(searchTerm);
            
            const matchesLocation = !locationTerm || 
                mess.address?.toLowerCase().includes(locationTerm);
            
            return matchesSearch && matchesLocation;
        }

        return true;
    });

    // STEP 7: Enhance mess data with both owner-wide and individual review information
    const enhancedMesses = filteredMesses.map((mess) => {
        const ownerReviewInfo = ownerReviewMap.get(mess.owner_id._id.toString()) || {
            averageRating: 0,
            totalReviews: 0,
            totalMesses: 0,
            ratingDistribution: []
        };

        const individualReviewInfo = individualReviewMap.get(mess._id.toString()) || {
            averageRating: 0,
            totalReviews: 0,
        };

        // Calculate rating distribution percentages
        const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        if (ownerReviewInfo.ratingDistribution.length > 0) {
            ownerReviewInfo.ratingDistribution.forEach((rating) => {
                ratingDistribution[rating]++;
            });
        }

        return {
            ...mess,
            ratingInfo: {
                // Owner-wide statistics (across all messes)
                ownerWideStats: {
                    averageRating: ownerReviewInfo.averageRating,
                    totalReviews: ownerReviewInfo.totalReviews,
                    totalMesses: ownerReviewInfo.totalMesses,
                    ratingDistribution: ratingDistribution,
                    message: ownerReviewInfo.totalReviews > 0 
                        ? `Based on ${ownerReviewInfo.totalReviews} reviews across ${ownerReviewInfo.totalMesses} mess${ownerReviewInfo.totalMesses > 1 ? 'es' : ''}`
                        : 'No reviews yet'
                },
                // Individual mess statistics
                individualMessStats: {
                    averageRating: individualReviewInfo.averageRating,
                    totalReviews: individualReviewInfo.totalReviews,
                    message: individualReviewInfo.totalReviews > 0 
                        ? `Based on ${individualReviewInfo.totalReviews} review${individualReviewInfo.totalReviews > 1 ? 's' : ''} for this mess`
                        : 'No reviews yet for this specific mess'
                }
            },
            owner_id: mess.owner_id._id,
            owner_name: mess.owner_id.name,
            owner_email: mess.owner_id.email,
            owner_phone: mess.owner_id.phone,
        };
    });

    // STEP 8: Handle rating sorting (if selected)
    if (sortBy === "rating") {
        enhancedMesses.sort((a, b) => {
            const ratingA = a.ratingInfo.ownerWideStats.averageRating;
            const ratingB = b.ratingInfo.ownerWideStats.averageRating;
            
            return sortOrder === "asc"
                ? ratingA - ratingB
                : ratingB - ratingA;
        });
    } else {
        // Apply other sorts (price, date)
        enhancedMesses.sort((a, b) => {
            switch (sortBy) {
                case "price":
                    return sortOrder === "asc" 
                        ? a.payPerMonth - b.payPerMonth 
                        : b.payPerMonth - a.payPerMonth;
                case "date":
                    return sortOrder === "asc" 
                        ? new Date(a.createdAt) - new Date(b.createdAt)
                        : new Date(b.createdAt) - new Date(a.createdAt);
                default:
                    return 0;
            }
        });
    }

    // STEP 9: Apply pagination
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
                search: search || "",
                location: location || "",
                sortBy,
                sortOrder,
                status: "free"
            },
            reviewInfo: {
                note: "Ratings are based on reviews across all messes by the same owner",
                totalOwnersWithReviews: ownerReviewStats.length,
                totalReviews: ownerReviewStats.reduce((sum, stat) => sum + stat.totalReviews, 0)
            }
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
