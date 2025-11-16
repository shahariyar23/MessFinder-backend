import MessListing from "../models/messListing.model.js";
import Booking from "../models/booking.model.js";
import Review from "../models/review.model.js";
import { deleteFromCloudinary } from "../utils/cloudinary.js";
import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiSuccess from "../utils/ApiSuccess.js";
import mongoose from "mongoose";

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
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can modify owners.");
    }
    
    const { ownerId } = req.params;
    const { name, email, phone, isActive } = req.body;
    
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Validate owner exists
        const owner = await User.findOne({ _id: ownerId, role: "owner" }).session(session);
        if (!owner) {
            throw new ApiError(404, "Owner not found");
        }

        // Check for unique constraints
        if (email && email !== owner.email) {
            const existingUser = await User.findOne({ email }).session(session);
            if (existingUser) {
                throw new ApiError(400, "Email already exists");
            }
        }

        if (phone && phone !== owner.phone) {
            const existingUser = await User.findOne({ phone }).session(session);
            if (existingUser) {
                throw new ApiError(400, "Phone number already exists");
            }
        }

        // Update owner
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (phone) updateData.phone = phone;
        
        if (isActive !== undefined) {
            updateData.isActive = isActive;
        }

        const updatedOwner = await User.findByIdAndUpdate(
            ownerId, 
            updateData, 
            { 
                new: true, 
                runValidators: true,
                session 
            }
        ).select("-password -resetPasswordCode -resetPasswordExpires -accessToken");

        // REMOVED THE AUTOMATIC MESS STATUS UPDATE

        // Commit transaction
        await session.commitTransaction();
        
        console.log(`✅ Owner ${ownerId} updated successfully`);
        
        return res.status(200).json(new ApiSuccess("Owner updated successfully", updatedOwner));

    } catch (error) {
        // Abort transaction on error
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
});
// Get user statistics (Admin only)
const getUserStatistics = asyncHandler(async (req, res) => {
    // Check if current user is admin
    if (req.user.role !== "admin") {
        throw new ApiError(
            403,
            "Access denied. Only admin can access statistics."
        );
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
                    address: { $exists: true, $ne: "" },
                },
            },
            {
                $group: {
                    _id: {
                        $toLower: {
                            $substrCP: ["$address", 0, 20],
                        },
                    },
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { count: -1 },
            },
            {
                $limit: 5,
            },
        ]);

        // Track mess listing updates and status changes
        const recentActivities = await MessListing.aggregate([
            {
                $sort: { updatedAt: -1 },
            },
            {
                $limit: 10,
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner_id",
                    foreignField: "_id",
                    as: "owner",
                },
            },
            {
                $unwind: "$owner",
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
                                            case: {
                                                $ne: [
                                                    "$status",
                                                    "$previousStatus",
                                                ],
                                            },
                                            then: {
                                                $concat: [
                                                    "Changed status to ",
                                                    "$status",
                                                ],
                                            },
                                        },
                                        {
                                            case: {
                                                $ne: [
                                                    "$payPerMonth",
                                                    "$previousPrice",
                                                ],
                                            },
                                            then: "Updated pricing",
                                        },
                                        {
                                            case: {
                                                $ne: [
                                                    "$facilities",
                                                    "$previousFacilities",
                                                ],
                                            },
                                            then: "Updated facilities",
                                        },
                                    ],
                                    default: "Updated mess listing",
                                },
                            },
                        },
                    },
                    time: "$updatedAt",
                    title: "$title",
                    type: "listing_update",
                    changes: {
                        $cond: {
                            if: { $eq: ["$createdAt", "$updatedAt"] },
                            then: "creation",
                            else: "update",
                        },
                    },
                },
            },
        ]);

        // Monthly growth for mess listings
        const monthlyGrowth = await MessListing.aggregate([
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                    },
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { "_id.year": -1, "_id.month": -1 },
            },
            {
                $limit: 6,
            },
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
                    latestUser: null,
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
                    latestListing: null,
                },
                byLocation: locationStats,
                monthlyGrowth: monthlyGrowth,
            },
            recentActivities: recentActivities.map((activity) => ({
                user: activity.user,
                action: activity.action,
                time: activity.time,
                title: activity.title,
            })),
        };

        return res
            .status(200)
            .json(
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

const deleteMess = asyncHandler(async (req, res) => {
    const { messId } = req.params;
    const userId = req.user.id;

    // Find the mess first to check ownership
    const mess = await MessListing.findById(messId);
    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    if (!mess) {
        throw new ApiError(404, "Mess not found");
    }

    // Check if owner_id exists and then compare
    if (!mess.owner_id) {
        throw new ApiError(400, "Mess owner information is missing");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Delete images from Cloudinary
        if (mess.image && mess.image.length > 0) {
            const deletePromises = mess.image.map((img) =>
                deleteFromCloudinary(img.public_id)
            );
            await Promise.all(deletePromises);
            //console.log(`Deleted ${mess.image.length} images from Cloudinary for mess ${messId}`);
        }

        // 2. Delete all bookings related to this mess
        const bookingDeletion = await Booking.deleteMany(
            { mess_id: messId },
            { session }
        );
        //console.log(`Deleted ${bookingDeletion.deletedCount} bookings for mess ${messId}`);

        // 3. Delete all payments related to this mess's bookings
        const messBookings = await Booking.find({ mess_id: messId }).select(
            "_id"
        );
        const bookingIds = messBookings.map((booking) => booking._id);

        if (bookingIds.length > 0) {
            const paymentDeletion = await Payment.deleteMany(
                { booking_id: { $in: bookingIds } },
                { session }
            );
            //console.log(`Deleted ${paymentDeletion.deletedCount} payments for mess ${messId}`);
        }

        // 4. Delete all reviews related to this mess
        const reviewDeletion = await Review.deleteMany(
            { mess_id: messId },
            { session }
        );
        //console.log(`Deleted ${reviewDeletion.deletedCount} reviews for mess ${messId}`);

        // 5. Remove this mess from all users' saved lists
        const savedListUpdate = await User.updateMany(
            { saved_mess: messId },
            { $pull: { saved_mess: messId } },
            { session }
        );
        //console.log(`Removed mess ${messId} from ${savedListUpdate.modifiedCount} users' saved lists`);

        // 6. Delete the mess itself
        await MessListing.findByIdAndDelete(messId, { session });

        // Commit the transaction
        await session.commitTransaction();
        //console.log(`Successfully completed deletion of mess ${messId}`);

        return res
            .status(200)
            .json(
                new ApiSuccess("Mess and all related data deleted successfully")
            );
    } catch (error) {
        // If anything fails, abort the transaction
        await session.abortTransaction();
        console.error("Error during mess deletion:", error);
        throw new ApiError(500, "Failed to delete mess and related data");
    } finally {
        session.endSession();
    }
});

const updateMess = asyncHandler(async (req, res) => {
    const { messId } = req.params;
    const userId = req.user.id; // Find admin user... (your code is fine)
    const {
        title,
        description,
        address,
        availableFrom,
        advancePaymentMonth,
        payPerMonth,
        facilities,
        roomType,
        roomFeatures,
        genderPreference,
        contact,
    } = req.body; 

    const existingMess = await MessListing.findById(messId);
    if (!existingMess) {
        throw new ApiError(404, "Mess not found!");
    } // --- FIX 2: Improved Array & Validation Logic ---
    // Handle string-to-array conversion

    let facilitiesArray = facilities;
    if (typeof facilities === "string") {
        try {
            facilitiesArray = JSON.parse(facilities);
        } catch (e) {
            throw new ApiError(400, "Invalid facilities format");
        }
    }
    let roomFeaturesArray = roomFeatures;
    if (typeof roomFeatures === "string") {
        try {
            roomFeaturesArray = JSON.parse(roomFeatures);
        } catch (e) {
            throw new ApiError(400, "Invalid roomFeatures format");
        }
    } // Validation Enums

    const validRoomTypes = ["Single", "Shared", "Double"];
    const validGenders = ["Male", "Female"];
    const validAdvancePayments = [0, 1, 2, 3];
    const validFacilities = [
        "Wi-Fi",
        "Meals",
        "Laundry",
        "Lifts",
        "Water Filter",
        "Freezer",
    ];
    const validRoomFeatures = [
        "Master Bed",
        "Attached Bath",
        "Balcony",
        "Furnished",
        "AC",
        "Geyser",
    ]; // Filter arrays *only if* they were provided.
    // If facilitiesArray is undefined, filteredFacilities will be undefined.
    // If facilitiesArray is [], filteredFacilities will be []. (This is the fix)

    const filteredFacilities = Array.isArray(facilitiesArray)
        ? facilitiesArray.filter((facility) =>
              validFacilities.includes(facility)
          )
        : undefined;
    const filteredRoomFeatures = Array.isArray(roomFeaturesArray)
        ? roomFeaturesArray.filter((feature) =>
              validRoomFeatures.includes(feature)
          )
        : undefined; // Handle date
    let availableFromDate;
    if (availableFrom) {
        const newDate = new Date(availableFrom);
        if (!isNaN(newDate.getTime())) {
            availableFromDate = newDate;
        }
    } // Prepare update data
    // This logic correctly handles undefined vs. provided values

    const updateData = {
        title: title !== undefined ? title.trim() : existingMess.title,
        description:
            description !== undefined
                ? description.trim()
                : existingMess.description,
        address: address !== undefined ? address.trim() : existingMess.address,
        payPerMonth:
            payPerMonth !== undefined
                ? Number(payPerMonth)
                : existingMess.payPerMonth,
        contact: contact !== undefined ? contact.trim() : existingMess.contact, // Use new date if valid, else keep old
        availableFrom: availableFromDate || existingMess.availableFrom, // Use new array if provided (even if empty), else keep old
        facilities:
            filteredFacilities !== undefined
                ? filteredFacilities
                : existingMess.facilities,
        roomFeatures:
            filteredRoomFeatures !== undefined
                ? filteredRoomFeatures
                : existingMess.roomFeatures, // Use new enum value if valid, else keep old
        roomType: validRoomTypes.includes(roomType)
            ? roomType
            : existingMess.roomType,
        genderPreference: validGenders.includes(genderPreference)
            ? genderPreference
            : existingMess.genderPreference,
        advancePaymentMonth: validAdvancePayments.includes(
            parseInt(advancePaymentMonth)
        )
            ? parseInt(advancePaymentMonth)
            : existingMess.advancePaymentMonth,
    }; // --- END FIX 2 ---

    console.log("Final update data for DB:", updateData); // Your save logic (Method 1 & 2) is fine.

    try {
        // Update the existing document
        Object.keys(updateData).forEach((key) => {
            // This check is good, but updateData object is already clean
            existingMess[key] = updateData[key];
        });

        const updatedMess = await existingMess.save();
        await updatedMess.populate("owner_id", "name email phone");

        return res
            .status(200)
            .json(
                new ApiSuccess(
                    "Mess listing updated successfully",
                    updatedMess,
                    200
                )
            );
    } catch (saveError) {
        console.error("Save error:", saveError); // ... fallback logic ...
    }
});


const getAllUsers = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Only admin can see all users");
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const search = req.query.search || "";
    const status = req.query.status || "";
    const role = req.query.role || "student";

    // Build filter object
    const filter = {};
    
    if (role) {
        filter.role = role;
    }

    // Status filter should use isActive field (boolean)
    if (status) {
        if (status === "active") {
            filter.isActive = true;
        } else if (status === "suspended") {
            filter.isActive = false;
        }
    }

    // Search across multiple fields
    if (search) {
        filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { contact: { $regex: search, $options: "i" } }
        ];
    }

    // Get users WITHOUT population first
    let users = await User.find(filter)
        .select("-password")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean();

    // For owners, get their mess listings and calculate stats
    if (role === "owner" && users.length > 0) {
        const ownerIds = users.map(user => user._id);
        
        // Get ALL mess listings for these owners in one query
        const allMessListings = await MessListing.find({ 
            owner_id: { $in: ownerIds } 
        })
        .select('owner_id status payPerMonth')
        .lean();

        // Group mess listings by owner ID for easy lookup
        const messByOwner = {};
        allMessListings.forEach(mess => {
            // FIX: Check if owner_id exists and is valid
            if (mess.owner_id && mess.owner_id.toString) {
                const ownerId = mess.owner_id.toString();
                if (!messByOwner[ownerId]) {
                    messByOwner[ownerId] = [];
                }
                messByOwner[ownerId].push(mess);
            }
        });

        // Attach mess listings to each user
        users = users.map(user => {
            const userMessListings = messByOwner[user._id.toString()] || [];
            return {
                ...user,
                messListings: userMessListings
            };
        });
    }
    // For students, populate bookings separately
    else if (role === "student" && users.length > 0) {
        const studentIds = users.map(user => user._id);
        
        // Get all bookings for these students
        const allBookings = await Booking.find({ 
            user_id: { $in: studentIds } 
        })
        .populate('mess_id', 'title address payPerMonth')
        .select('status startDate endDate totalAmount mess_id user_id')
        .lean();

        // Group bookings by student ID
        const bookingsByStudent = {};
        allBookings.forEach(booking => {
            // FIX: Check if user_id exists and is valid
            if (booking.user_id && booking.user_id.toString) {
                const studentId = booking.user_id.toString();
                if (!bookingsByStudent[studentId]) {
                    bookingsByStudent[studentId] = [];
                }
                bookingsByStudent[studentId].push(booking);
            }
        });

        // Attach bookings to each user
        users = users.map(user => {
            const userBookings = bookingsByStudent[user._id.toString()] || [];
            return {
                ...user,
                bookings: userBookings
            };
        });
    }

    // Format users for frontend
    const formattedUsers = users.map(user => {
        let listings = "";
        let ownerStats = null;
        
        if (user.role === "student" && user.bookings) {
            listings = `${user.bookings.length} booking${user.bookings.length !== 1 ? 's' : ''}`;
        } else if (user.role === "owner" && user.messListings) {
            const messListings = user.messListings || [];
            const totalMess = messListings.length;
            const activeMess = messListings.filter(mess => mess.status === 'active').length;
            const inactiveMess = messListings.filter(mess => mess.status === 'inactive').length;
            const totalRevenue = messListings
                .filter(mess => mess.status === 'active')
                .reduce((sum, mess) => sum + (mess.payPerMonth || 0), 0);

            listings = `${totalMess} listing${totalMess !== 1 ? 's' : ''}`;
            
            ownerStats = {
                totalMess,
                activeMess,
                inactiveMess,
                totalRevenue
            };
        }

        // Use isActive field (boolean) to determine status and statusColor
        const isActive = user.isActive;
        const status = isActive ? "Active" : "Suspended";
        const statusColor = isActive ? "bg-green-100" : "bg-red-100";

        return {
            id: user._id,
            name: user.name,
            email: user.email,
            contact: user.contact || user.email,
            role: user.role,
            status: status,
            statusColor: statusColor,
            listings: listings,
            createdAt: user.createdAt,
            isActive: user.isActive,
            ownerStats: ownerStats
        };
    });

    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);

    return res.status(200).json(
        new ApiSuccess("Users retrieved successfully", {
            users: formattedUsers,
            pagination: {
                currentPage: page,
                totalPages,
                totalUsers,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        })
    );
});

const getAllMess = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { minRating, maxRating, status } = req.query;
if(req.user.role !== "admin"){
    throw new ApiError(400, "Your are not allow for this page")
}
    // Build base query - include status filter if provided, otherwise get all
    const baseQuery = status ? { status } : {};
    
    //console.log('🔍 Filtering messes with query:', baseQuery);

    // STEP 1: Get total count based on status filter
    const totalMess = await MessListing.countDocuments(baseQuery);

    // STEP 2: Find messes with pagination and optional status filter
    const messes = await MessListing.find(baseQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('owner_id', 'name email phone isActive') // Populate owner info
        .lean();

    //console.log(`✅ Found ${messes.length} messes with query:`, baseQuery);

    // Debug: Check status of returned messes
    messes.forEach((mess, index) => {
        //console.log(`📦 Mess ${index + 1}: ID=${mess._id}, Status=${mess.status}, Title=${mess.title}`);
    });

    // STEP 3: Filter out messes where owner is not active
    const activeOwnerMesses = messes.filter(mess => 
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
                    status: mess.status, // This will now show actual status
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
            pagination: {
                currentPage: page,
                totalPages,
                totalMess: finalCount, // Final count after all filters
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
            filters: {
                status: status || 'all', // Show applied status or 'all'
                minRating: minRating || null,
                maxRating: maxRating || null
            }
        })
    );
});




export {
    deleteOwner,
    deleteUser,
    modifyOwner,
    modifyUser,
    getUserStatistics,
    bulkUserActions,
    deleteMess,
    updateMess,
    getAllUsers,
    getAllMess
};
