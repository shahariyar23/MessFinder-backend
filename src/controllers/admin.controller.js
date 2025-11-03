import MessListing from "../models/messListing.model.js";
import Booking from "../models/booking.model.js";
import Review from "../models/review.model.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";
import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiSuccess from "../utils/ApiSuccess.js";


// Delete user (Admin only)
const deleteUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user.id.toString()) {
        throw new ApiError(400, "You cannot delete your own account");
    }

    // Handle different user roles
    if (user.role === "owner") {
        // Delete owner's mess listings and related data
        await Promise.all([
            MessListing.deleteMany({ owner_id: userId }),
            Booking.deleteMany({ owner_id: userId }),
            Review.deleteMany({ user_id: userId }),
        ]);
    } else if (user.role === "student") {
        // Delete student's bookings and reviews
        await Promise.all([
            Booking.deleteMany({ user_id: userId }),
            Review.deleteMany({ user_id: userId }),
        ]);
    }

    // Delete the user
    await User.findByIdAndDelete(userId);

    return res
        .status(200)
        .json(new ApiSuccess(`User (${user.role}) deleted successfully`));
});

// Modify user (Admin only)
const modifyUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { name, email, phone, role, isActive } = req.body;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Prevent role modification of admin users
    if (user.role === "admin" && role && role !== "admin") {
        throw new ApiError(400, "Cannot change admin user role");
    }

    // Prevent modifying own account's role or active status
    if (user._id.toString() === req.user.id.toString()) {
        if (role && role !== req.user.role) {
            throw new ApiError(400, "You cannot change your own role");
        }
        if (isActive !== undefined && !isActive) {
            throw new ApiError(400, "You cannot deactivate your own account");
        }
    }

    // Check for unique constraints
    if (email && email !== user.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new ApiError(400, "Email already exists");
        }
    }

    if (phone && phone !== user.phone) {
        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            throw new ApiError(400, "Phone number already exists");
        }
    }

    // Update user
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
        new: true,
        runValidators: true,
    }).select(
        "-password -resetPasswordCode -resetPasswordExpires -accessToken"
    );

    return res
        .status(200)
        .json(new ApiSuccess("User updated successfully", updatedUser));
    });

// delete owner only admin
const deleteOwner = asyncHandler(async (req, res) => {
    const { ownerId } = req.params;

    // Check if current user is admin
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can delete owners.");
    }

    // Validate owner exists and is actually an owner
    const owner = await User.findOne({ _id: ownerId, role: "owner" });
    if (!owner) {
        throw new ApiError(404, "Owner not found");
    }

    // Prevent admin from deleting themselves
    if (owner._id.toString() === req.user.id.toString()) {
        throw new ApiError(400, "You cannot delete your own account");
    }

    try {
        // Get all mess listings of this owner
        const ownerMessListings = await MessListing.find({ owner_id: ownerId });

        // Delete images from Cloudinary for all mess listings
        const cloudinaryDeletePromises = ownerMessListings.flatMap((mess) =>
            mess.image.map((img) =>
                deleteFromCloudinary(img.public_id).catch((error) =>
                    console.error(
                        `Failed to delete image ${img.public_id}:`,
                        error
                    )
                )
            )
        );

        // Execute all deletion operations
        await Promise.allSettled([
            // Delete Cloudinary images (continue even if some fail)
            ...cloudinaryDeletePromises,

            // Delete database records
            MessListing.deleteMany({ owner_id: ownerId }),
            Booking.updateMany(
                { owner_id: ownerId },
                { $set: { bookingStatus: "cancelled" } }
            ),
            Review.deleteMany({ user_id: ownerId }),
            User.findByIdAndDelete(ownerId),
        ]);

        return res
            .status(200)
            .json(
                new ApiSuccess(
                    "Owner and all related data deleted successfully"
                )
            );
    } catch (error) {
        console.error("Error deleting owner:", error);
        throw new ApiError(500, "Failed to delete owner and related data");
    }
});

// Modify owner (Admin only - specialized for owners)
const modifyOwner = asyncHandler(async (req, res) => {
     // Check if current user is admin
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can delete owners.");
    }
    const { ownerId } = req.params;
    const { name, email, phone, isActive } = req.body;

    // Validate owner exists
    const owner = await User.findOne({ _id: ownerId, role: "owner" });
    if (!owner) {
        throw new ApiError(404, "Owner not found");
    }

    // Check for unique constraints
    if (email && email !== owner.email) {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            throw new ApiError(400, "Email already exists");
        }
    }

    if (phone && phone !== owner.phone) {
        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            throw new ApiError(400, "Phone number already exists");
        }
    }

    // Update owner
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedOwner = await User.findByIdAndUpdate(ownerId, updateData, {
        new: true,
        runValidators: true,
    }).select(
        "-password -resetPasswordCode -resetPasswordExpires -accessToken"
    );

    // If owner is deactivated, also deactivate their mess listings
    if (isActive === false) {
        await MessListing.updateMany(
            { owner_id: ownerId },
            { status: "in progress" } // Or whatever status indicates temporary unavailability
        );
    }

    return res
        .status(200)
        .json(new ApiSuccess("Owner updated successfully", updatedOwner));
});

// Get user statistics (Admin only)
const getUserStatistics = asyncHandler(async (req, res) => {
    // Check if current user is admin
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can access statistics.");
    }

    try {
        // User Statistics
        const userStats = await User.aggregate([
            {
                $group: {
                    _id: "$role",
                    count: { $sum: 1 },
                    activeUsers: {
                        $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
                    },
                    inactiveUsers: {
                        $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] },
                    },
                },
            },
        ]);

        const totalUserStats = await User.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    totalActive: {
                        $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
                    },
                    latestUser: { $max: "$createdAt" },
                },
            },
        ]);

        // Mess Listing Statistics
        const messStats = await MessListing.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                },
            },
        ]);

        const totalMessStats = await MessListing.aggregate([
            {
                $group: {
                    _id: null,
                    totalListings: { $sum: 1 },
                    totalViews: { $sum: "$view" },
                    avgPrice: { $avg: "$payPerMonth" },
                    latestListing: { $max: "$createdAt" },
                },
            },
        ]);

        // Mess Listings by Location
        const locationStats = await MessListing.aggregate([
            {
                $match: {
                    address: { $exists: true, $ne: "" }
                }
            },
            {
                $group: {
                    _id: {
                        $toLower: {
                            $substrCP: [
                                "$address",
                                0,
                                20
                            ]
                        }
                    },
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 5
            }
        ]);

        // Track mess listing updates and status changes
const recentActivities = await MessListing.aggregate([
    {
        $sort: { updatedAt: -1 }
    },
    {
        $limit: 10
    },
    {
        $lookup: {
            from: "users",
            localField: "owner_id",
            foreignField: "_id",
            as: "owner"
        }
    },
    {
        $unwind: "$owner"
    },
    {
        $project: {
            user: "$owner.name",
            action: {
                $cond: {
                    if: { $eq: ["$createdAt", "$updatedAt"] },
                    then: "Created new mess listing",
                    else: {
                        $switch: {
                            branches: [
                                { 
                                    case: { $ne: ["$status", "$previousStatus"] }, 
                                    then: {
                                        $concat: [
                                            "Changed status to ",
                                            "$status"
                                        ]
                                    }
                                },
                                { 
                                    case: { $ne: ["$payPerMonth", "$previousPrice"] }, 
                                    then: "Updated pricing"
                                },
                                { 
                                    case: { $ne: ["$facilities", "$previousFacilities"] }, 
                                    then: "Updated facilities"
                                }
                            ],
                            default: "Updated mess listing"
                        }
                    }
                }
            },
            time: "$updatedAt",
            title: "$title",
            type: "listing_update",
            changes: {
                $cond: {
                    if: { $eq: ["$createdAt", "$updatedAt"] },
                    then: "creation",
                    else: "update"
                }
            }
        }
    }
]);

        // Monthly growth for mess listings
        const monthlyGrowth = await MessListing.aggregate([
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { "_id.year": -1, "_id.month": -1 }
            },
            {
                $limit: 6
            }
        ]);

        const statistics = {
            users: {
                byRole: userStats.reduce((acc, curr) => {
                    acc[curr._id] = curr;
                    return acc;
                }, {}),
                overall: totalUserStats[0] || { 
                    totalUsers: 0, 
                    totalActive: 0,
                    latestUser: null 
                },
            },
            messListings: {
                byStatus: messStats.reduce((acc, curr) => {
                    acc[curr._id] = curr.count;
                    return acc;
                }, {}),
                overall: totalMessStats[0] || {
                    totalListings: 0,
                    totalViews: 0,
                    avgPrice: 0,
                    latestListing: null
                },
                byLocation: locationStats,
                monthlyGrowth: monthlyGrowth,
            },
            recentActivities: recentActivities.map(activity => ({
                user: activity.user,
                action: activity.action,
                time: activity.time,
                title: activity.title
            }))
        };

        return res.status(200).json(
            new ApiSuccess("Statistics retrieved successfully", statistics)
        );
    } catch (error) {
        console.error("Error fetching statistics:", error);
        throw new ApiError(500, "Failed to retrieve statistics");
    }
});

// Bulk user actions (Admin only)
const bulkUserActions = asyncHandler(async (req, res) => {
    const { userIds, action } = req.body;
     // Check if current user is admin
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can delete owners.");
    }

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        throw new ApiError(400, "User IDs array is required");
    }

    if (!["activate", "deactivate", "delete"].includes(action)) {
        throw new ApiError(
            400,
            "Invalid action. Use 'activate', 'deactivate', or 'delete'"
        );
    }

    // Prevent self-modification in bulk actions
    if (userIds.includes(req.user.id.toString())) {
        throw new ApiError(
            400,
            "Cannot perform bulk actions on your own account"
        );
    }

    let result;
    switch (action) {
        case "activate":
            result = await User.updateMany(
                { _id: { $in: userIds } },
                { isActive: true }
            );
            break;

        case "deactivate":
            result = await User.updateMany(
                { _id: { $in: userIds } },
                { isActive: false }
            );
            break;

        case "delete":
            // First get users to handle role-specific cleanup
            const usersToDelete = await User.find({ _id: { $in: userIds } });

            // Separate by role for efficient deletion
            const owners = usersToDelete.filter(
                (user) => user.role === "owner"
            );
            const students = usersToDelete.filter(
                (user) => user.role === "student"
            );

            // Delete related data
            await Promise.all([
                // Delete owners' mess listings
                MessListing.deleteMany({
                    owner_id: { $in: owners.map((o) => o._id) },
                }),

                // Delete all users' bookings and reviews
                Booking.deleteMany({ user_id: { $in: userIds } }),
                Review.deleteMany({ user_id: { $in: userIds } }),

                // Delete the users
                User.deleteMany({ _id: { $in: userIds } }),
            ]);

            result = { deletedCount: usersToDelete.length };
            break;
    }

    return res.status(200).json(
        new ApiSuccess(`Bulk action '${action}' completed successfully`, {
            affectedUsers: userIds.length,
            result,
        })
    );
});



export {
    deleteOwner,
    deleteUser,
    modifyOwner,
    modifyUser,
    getUserStatistics,
    bulkUserActions
}
