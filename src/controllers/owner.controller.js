import MessListing from "../models/messListing.model.js";
import Review from "../models/review.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiSuccess from "../utils/ApiSuccess.js";
import asyncHandler from "../utils/asyncHandler.js";

const getMessesByOwnerId = asyncHandler(async (req, res) => {
    const { ownerId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    // Validate ownerId
    if (!ownerId) {
        throw new ApiError(400, "Owner ID is required");
    }

    // Check if owner exists
    const owner = await User.findById(ownerId);
    if (!owner) {
        throw new ApiError(404, "Owner not found");
    }

    // Build query
    const query = { owner_id: ownerId };

    if (status && ["free", "booked", "in progress"].includes(status)) {
        query.status = status;
    }

    const skip = (page - 1) * limit;

    // Get messes with pagination
    const messes = await MessListing.find(query)
        .populate("owner_id", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

    // Get total count
    const totalMesses = await MessListing.countDocuments(query);

    // Get review stats for these messes
    const reviewStats = await Review.aggregate([
        {
            $match: {
                status: "active",
                mess_id: { $in: messes.map((m) => m._id) },
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

    // Create review map
    const reviewMap = new Map();
    reviewStats.forEach((stat) => {
        reviewMap.set(stat._id.toString(), {
            averageRating: Math.round(stat.averageRating * 10) / 10 || 0,
            totalReviews: stat.totalReviews || 0,
        });
    });

    // Enhance mess data
    const enhancedMesses = messes.map((mess) => ({
        ...mess,
        ratingInfo: reviewMap.get(mess._id.toString()) || {
            averageRating: 0,
            totalReviews: 0,
        },
    }));

    // Calculate basic statistics
    const totalViews = enhancedMesses.reduce(
        (sum, mess) => sum + (mess.view || 0),
        0
    );
    const freeMesses = enhancedMesses.filter(
        (mess) => mess.status === "free"
    ).length;
    const bookedMesses = enhancedMesses.filter(
        (mess) => mess.status === "booked"
    ).length;
    const pendingMesses = enhancedMesses.filter(
        (mess) => mess.status === "pending"
    ).length;

    const totalPages = Math.ceil(totalMesses / limit);

    return res.status(200).json(
        new ApiSuccess("Owner messes retrieved successfully", {
            messes: enhancedMesses,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalMesses,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
            statistics: {
                totalMesses,
                freeMesses,
                bookedMesses,
                pendingMesses,
                totalViews,
            },
        })
    );
});

const updateMessStatus = asyncHandler(async (req, res) => {
    const { mess_id, status } = req.body;
    const owner_id = req.user?.id; // From authenticated middleware
    console.log("Full request body:", req.body);
    console.log("Request headers:", req.headers);
    console.log("Request method:", req.method);

    
    console.log("Destructured:", { mess_id, status });
    // Validate input
    if (!mess_id) {
        throw new ApiError(400, "Mess ID is required");
    }

    if (!status) {
        throw new ApiError(400, "Status is required");
    }

    // Validate status value
    const allowedStatuses = ["free", "booked", "in progress", "pending"];
    if (!allowedStatuses.includes(status)) {
        throw new ApiError(
            400,
            `Status must be one of: ${allowedStatuses.join(", ")}`
        );
    }

    // Check if mess exists and belongs to the current user
    const existingMess = await MessListing.findOne({
        _id: mess_id,
        owner_id: owner_id,
    });

    if (!existingMess) {
        throw new ApiError(404, "Mess not found or access denied");
    }

    // Prevent unnecessary updates
    if (existingMess.status === status) {
        return res.status(200).json(
            new ApiSuccess(
                "Mess status is already set to the requested status",
                {
                    mess: existingMess,
                }
            )
        );
    }

    // Update mess status
    const updatedMess = await MessListing.findByIdAndUpdate(
        mess_id,
        {
            $set: {
                status: status,
                updatedAt: new Date(),
            },
        },
        {
            new: true,
            runValidators: true,
        }
    ).populate("owner_id", "name email phone");

    if (!updatedMess) {
        throw new ApiError(500, "Failed to update mess status");
    }

    // Log the status change (optional)
    console.log(
        `Mess ${mess_id} status changed from ${existingMess.status} to ${status} by owner ${owner_id}`
    );

    return res.status(200).json(
        new ApiSuccess("Mess status updated successfully", {
            mess: updatedMess,
            statusChange: {
                from: existingMess.status,
                to: status,
            },
            timestamp: new Date().toISOString(),
        })
    );
});

export { getMessesByOwnerId, updateMessStatus };
