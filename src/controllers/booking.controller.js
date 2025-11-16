import Booking from "../models/booking.model.js";
import User from "../models/user.model.js"
import MessListing from "../models/messListing.model.js";
import ApiError from "../utils/ApiError.js";
import ApiSuccess from "../utils/ApiSuccess.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
    sendBookingConfirmation,
    sendOwnerNotification,
} from "../utils/service/emailService.js";

// Create a new booking
const createBooking = asyncHandler(async (req, res) => {
    const {
        mess_id,
        checkInDate,
        paymentMethod,
        tenantName,
        tenantPhone,
        tenantEmail,
        payAbleAmount,
        emergencyContact
    } = req.body;
    const user = await User.findById(req.user.id);
    if(!user){
        throw new ApiError(404, "User not found!!")
    }
    if(user.isActive !== true){
        throw new ApiError(403, `${user.name} is suspended`)
    }
    // Validate required fields
    if (!mess_id || !checkInDate || !tenantName || !tenantPhone || !tenantEmail || !payAbleAmount) {
        throw new ApiError(400, "All required fields must be provided");
    }

    // Check if mess exists and is available
    const mess = await MessListing.findById(mess_id);
    if (!mess) {
        throw new ApiError(404, "Mess not found");
    }

    if (mess.status !== "free") {
        throw new ApiError(400, `This mess is already ${MessListing?.status}`);
    }

    // Calculate total amount
    const totalAmount = mess.payPerMonth * mess.advancePaymentMonth;

    // Create booking
    const booking = new Booking({
        user_id: req.user.id,
        mess_id,
        owner_id: mess.owner_id,
        checkInDate: new Date(checkInDate),
        totalAmount,
        advanceMonths: mess?.advancePaymentMonth,
        paymentMethod,
        tenantName,
        tenantPhone,
        tenantEmail,
        payAbleAmount,
        emergencyContact,
        bookingStatus: "pending",
        paymentStatus: "pending"
    });

    await booking.save();

    
    await MessListing.findByIdAndUpdate(mess_id, {
        status: "pending"
    });

    
    await sendBookingConfirmation(tenantEmail, {
        tenantName,
        messName: mess.title,
        address: mess.address,
        checkInDate: booking.checkInDate,
        transactionId: booking._id,
        amount: booking.totalAmount,
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.bookingStatus,
        bookingLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`
    });
    
    
    // You need to fetch owner email first - you'll need to import User model
    const owner = await User.findById(mess.owner_id); 
    if (owner && owner.email) {
        await sendOwnerNotification(owner.email, {
            messName: mess.title,
            tenantName: booking.tenantName,
            checkInDate: booking.checkInDate,
            amount: booking.totalAmount,
            tenantEmail: booking.tenantEmail
        });
    }

    // Populate references for response
    await booking.populate('mess_id', 'title address payPerMonth facilities');
    await booking.populate('owner_id', 'name email phone');

    return res.status(201).json(
        new ApiSuccess(`Booking for ${mess?.title} created successfully`, booking, 201)
    );
});

// Get all bookings for a user with upcoming/past filtering
const getUserBookings = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status, type } = req.query;
    const skip = (page - 1) * limit;
    const currentDate = new Date();

    let query = { user_id: req.user.id };

    // Add status filter if provided
    if (status) {
        query.bookingStatus = status;
    }

    // Add date filter based on type (upcoming/past)
    if (type === "upcoming") {
        query.checkInDate = { $gte: currentDate };
    } else if (type === "past") {
        query.checkInDate = { $lt: currentDate };
    }

    const [bookings, totalBookings] = await Promise.all([
        Booking.find(query)
            .populate("mess_id", "title address images payPerMonth")
            .populate("owner_id", "name phone")
            .sort({ checkInDate: type === "upcoming" ? 1 : -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Booking.countDocuments(query),
    ]);

    // Get counts for upcoming and past bookings for frontend tabs
    const upcomingCount = await Booking.countDocuments({
        user_id: req.user.id,
        checkInDate: { $gte: currentDate },
    });

    const pastCount = await Booking.countDocuments({
        user_id: req.user.id,
        checkInDate: { $lt: currentDate },
    });

    const totalPages = Math.ceil(totalBookings / limit);

    return res.status(200).json(
        new ApiSuccess("Bookings retrieved successfully", {
            bookings,
            counts: {
                upcoming: upcomingCount,
                past: pastCount,
                total: totalBookings,
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalBookings,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        })
    );
});

// Get all bookings for an owner with upcoming/past filtering
const getOwnerBookings = asyncHandler(async (req, res) => {
    const { ownerId } = req.params;

    if (req.user.role !== "owner") {
        throw new ApiError(403, "Only owners can access this resource");
    }

    const { page = 1, limit = 10, status, type } = req.query;
    const skip = (page - 1) * limit;
    const currentDate = new Date();

    let query = { owner_id: ownerId };

    // Add status filter if provided
    if (status) {
        query.bookingStatus = status;
    }

    // Add date filter based on type (upcoming/past)
    if (type === "upcoming") {
        query.checkInDate = { $gte: currentDate };
    } else if (type === "past") {
        query.checkInDate = { $lt: currentDate };
    }

    const [bookings, totalBookings] = await Promise.all([
        Booking.find(query)
            .populate("user_id", "name email phone")
            .populate("mess_id", "title address")
            .sort({ checkInDate: type === "upcoming" ? 1 : -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Booking.countDocuments(query),
    ]);

    // Get counts for upcoming and past bookings for frontend tabs
    const upcomingCount = await Booking.countDocuments({
        owner_id: ownerId,
        checkInDate: { $gte: currentDate },
    });

    const pastCount = await Booking.countDocuments({
        owner_id: ownerId,
        checkInDate: { $lt: currentDate },
    });

    const totalPages = Math.ceil(totalBookings / limit);

    return res.status(200).json(
        new ApiSuccess("Owner bookings retrieved successfully", {
            bookings,
            counts: {
                upcoming: upcomingCount,
                past: pastCount,
                total: totalBookings,
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalBookings,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        })
    );
});

// Get single booking by ID
const getBookingById = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
        .populate("user_id", "name email phone")
        .populate("owner_id", "name email phone")
        .populate("mess_id", "title address payPerMonth facilities images");

    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    // Check if user has permission to view this booking
    const isUser = booking.user_id._id.toString() === req.user.id.toString();
    const isOwner = booking.owner_id._id.toString() === req.user.id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isUser && !isOwner && !isAdmin) {
        throw new ApiError(403, "Access denied to this booking");
    }

    return res
        .status(200)
        .json(new ApiSuccess("Booking retrieved successfully", booking));
});

// Update booking status (Owner only)
const updateBookingStatus = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const { bookingStatus } = req.body;

    if (!bookingStatus) {
        throw new ApiError(400, "Booking status is required");
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    // Check if user is the owner of the mess
    if (booking.owner_id.toString() !== req.user.id.toString()) {
        throw new ApiError(
            403,
            "Only the mess owner can update booking status"
        );
    }

    // Update booking status
    booking.bookingStatus = bookingStatus;
    await booking.save();

    // If booking is confirmed, update mess status
    if (bookingStatus === "confirmed") {
        await MessListing.findByIdAndUpdate(booking.mess_id, {
            status: "booked",
        });
    }

    // If booking is cancelled or rejected, make mess available again
    if (bookingStatus === "cancelled" || bookingStatus === "rejected") {
        await MessListing.findByIdAndUpdate(booking.mess_id, {
            status: "free",
        });
    }

    await booking.populate("user_id", "name email");
    await booking.populate("mess_id", "title");

    return res
        .status(200)
        .json(new ApiSuccess(`Booking ${bookingStatus} successfully`, booking));
});

// Update payment status
const updatePaymentStatus = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const { paymentStatus, transactionId } = req.body;

    if (!paymentStatus) {
        throw new ApiError(400, "Payment status is required");
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    // Check permissions
    const isUser = booking.user_id.toString() === req.user.id.toString();
    const isOwner = booking.owner_id.toString() === req.user.id.toString();

    if (!isUser && !isOwner) {
        throw new ApiError(403, "Access denied to update payment status");
    }

    booking.paymentStatus = paymentStatus;
    if (transactionId) {
        booking.transactionId = transactionId;
    }

    await booking.save();

    return res
        .status(200)
        .json(new ApiSuccess("Payment status updated successfully", booking));
});

// Cancel booking (User only)
const cancelBooking = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    // Check if user owns this booking
    if (booking.user_id.toString() !== req.user.id.toString()) {
        throw new ApiError(403, "You can only cancel your own bookings");
    }

    // Check if booking can be cancelled
    if (booking.bookingStatus === "cancelled") {
        throw new ApiError(400, "Booking is already cancelled");
    }

    if (booking.bookingStatus === "completed") {
        throw new ApiError(400, "Cannot cancel completed booking");
    }

    booking.bookingStatus = "cancelled";
    await booking.save();

    // Make mess available again
    await MessListing.findByIdAndUpdate(booking.mess_id, { status: "free" });

    return res
        .status(200)
        .json(new ApiSuccess("Booking cancelled successfully", booking));
});

// Delete booking (Admin only)
const deleteBooking = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    if (req.user.role !== "admin") {
        throw new ApiError(403, "Only admin can delete bookings");
    }

    const booking = await Booking.findByIdAndDelete(bookingId);
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    return res.status(200).json(new ApiSuccess("Booking deleted successfully"));
});



// admin section
const getAllBookingsAdmin = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can access all bookings.");
    }

    const { 
        page = 1, 
        limit = 10, 
        status, 
        paymentStatus, 
        startDate, 
        endDate,
        userId,
        ownerId,
        messId,
        search 
    } = req.query;
    
    const skip = (page - 1) * limit;

    let query = {};

    // Add status filters if provided
    if (status) {
        query.bookingStatus = status;
    }

    if (paymentStatus) {
        query.paymentStatus = paymentStatus;
    }

    // Add date range filter
    if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Add user/owner/mess specific filters
    if (userId) {
        query.user_id = userId;
    }

    if (ownerId) {
        query.owner_id = ownerId;
    }

    if (messId) {
        query.mess_id = messId;
    }

    // Add search functionality
    if (search) {
        query.$or = [
            { transactionId: { $regex: search, $options: 'i' } },
            { tenantName: { $regex: search, $options: 'i' } },
            { tenantEmail: { $regex: search, $options: 'i' } },
            { tenantPhone: { $regex: search, $options: 'i' } },
            { 'user_id.name': { $regex: search, $options: 'i' } },
            { 'owner_id.name': { $regex: search, $options: 'i' } },
            { 'mess_id.title': { $regex: search, $options: 'i' } }
        ];
    }

    const [bookings, totalBookings] = await Promise.all([
        Booking.find(query)
            .populate("user_id", "name email phone")
            .populate("owner_id", "name email phone")
            .populate("mess_id", "title address payPerMonth facilities images")
            .sort({ createdAt: -1, checkInDate: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Booking.countDocuments(query),
    ]);

    // Get booking statistics
    const bookingStats = await Booking.aggregate([
        { $match: query },
        {
            $group: {
                _id: "$bookingStatus",
                count: { $sum: 1 },
                totalRevenue: { $sum: "$payAbleAmount" }
            }
        }
    ]);

    // Get payment statistics
    const paymentStats = await Booking.aggregate([
        { $match: query },
        {
            $group: {
                _id: "$paymentStatus",
                count: { $sum: 1 },
                totalAmount: { $sum: "$payAbleAmount" }
            }
        }
    ]);

    // Get total revenue and booking counts
    const revenueStats = await Booking.aggregate([
        { 
            $match: { 
                ...query, 
                paymentStatus: "paid" 
            } 
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: "$payAbleAmount" },
                totalBookings: { $sum: 1 },
                averageAmount: { $avg: "$payAbleAmount" }
            }
        }
    ]);

    // Get monthly trends
    const monthlyTrends = await Booking.aggregate([
        {
            $match: {
                createdAt: { 
                    $gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) 
                }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" }
                },
                count: { $sum: 1 },
                revenue: { $sum: "$payAbleAmount" }
            }
        },
        {
            $sort: { "_id.year": 1, "_id.month": 1 }
        }
    ]);

    const totalPages = Math.ceil(totalBookings / limit);
    const revenueData = revenueStats[0] || { totalRevenue: 0, totalBookings: 0, averageAmount: 0 };

    // Convert stats to objects
    const statusCounts = {};
    bookingStats.forEach(item => {
        statusCounts[item._id] = {
            count: item.count,
            revenue: item.totalRevenue
        };
    });

    const paymentStatusCounts = {};
    paymentStats.forEach(item => {
        paymentStatusCounts[item._id] = {
            count: item.count,
            amount: item.totalAmount
        };
    });

    return res.status(200).json(
        new ApiSuccess("All bookings retrieved successfully", {
            bookings,
            statistics: {
                statusCounts,
                paymentStatusCounts,
                revenue: revenueData,
                monthlyTrends,
                totalBookings
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalBookings,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
            filters: {
                status,
                paymentStatus,
                startDate,
                endDate,
                userId,
                ownerId,
                messId,
                search
            }
        })
    );
});

// Get booking statistics for admin dashboard
const getBookingStatistics = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can access booking statistics.");
    }

    const { period = "month" } = req.query;
    const currentDate = new Date();
    let startDate;

    switch (period) {
        case "week":
            startDate = new Date(currentDate.setDate(currentDate.getDate() - 7));
            break;
        case "month":
            startDate = new Date(currentDate.setMonth(currentDate.getMonth() - 1));
            break;
        case "year":
            startDate = new Date(currentDate.setFullYear(currentDate.getFullYear() - 1));
            break;
        default:
            startDate = new Date(currentDate.setMonth(currentDate.getMonth() - 1));
    }

    // Get booking trends
    const bookingTrends = await Booking.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" },
                    day: { $dayOfMonth: "$createdAt" }
                },
                totalBookings: { $sum: 1 },
                confirmedBookings: {
                    $sum: { $cond: [{ $eq: ["$bookingStatus", "confirmed"] }, 1, 0] }
                },
                pendingBookings: {
                    $sum: { $cond: [{ $eq: ["$bookingStatus", "pending"] }, 1, 0] }
                },
                revenue: { 
                    $sum: { 
                        $cond: [
                            { $eq: ["$paymentStatus", "paid"] }, 
                            "$payAbleAmount", 
                            0 
                        ] 
                    } 
                }
            }
        },
        {
            $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
        }
    ]);

    // Get top performing messes
    const topMesses = await Booking.aggregate([
        {
            $match: { 
                bookingStatus: "confirmed",
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: "$mess_id",
                bookingCount: { $sum: 1 },
                totalRevenue: { 
                    $sum: { 
                        $cond: [
                            { $eq: ["$paymentStatus", "paid"] }, 
                            "$payAbleAmount", 
                            0 
                        ] 
                    } 
                },
                averageRevenue: { 
                    $avg: { 
                        $cond: [
                            { $eq: ["$paymentStatus", "paid"] }, 
                            "$payAbleAmount", 
                            0 
                        ] 
                    } 
                }
            }
        },
        {
            $sort: { bookingCount: -1, totalRevenue: -1 }
        },
        {
            $limit: 10
        },
        {
            $lookup: {
                from: "messlistings",
                localField: "_id",
                foreignField: "_id",
                as: "messDetails"
            }
        },
        {
            $unwind: "$messDetails"
        }
    ]);

    // Get user booking statistics
    const userStats = await Booking.aggregate([
        {
            $match: { 
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: "$user_id",
                bookingCount: { $sum: 1 },
                totalSpent: { 
                    $sum: { 
                        $cond: [
                            { $eq: ["$paymentStatus", "paid"] }, 
                            "$payAbleAmount", 
                            0 
                        ] 
                    } 
                }
            }
        },
        {
            $sort: { bookingCount: -1, totalSpent: -1 }
        },
        {
            $limit: 10
        },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "userDetails"
            }
        },
        {
            $unwind: "$userDetails"
        }
    ]);

    // Get recent bookings for activity feed
    const recentBookings = await Booking.find({})
        .populate("user_id", "name email")
        .populate("mess_id", "title")
        .populate("owner_id", "name")
        .sort({ createdAt: -1 })
        .limit(10)
        .select("tenantName bookingStatus paymentStatus payAbleAmount createdAt")
        .lean();

    return res.status(200).json(
        new ApiSuccess("Booking statistics retrieved successfully", {
            trends: bookingTrends,
            topMesses,
            topUsers: userStats,
            recentBookings,
            period,
            dateRange: {
                start: startDate,
                end: new Date()
            }
        })
    );
});

// Admin update booking status
const adminUpdateBookingStatus = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can update booking status.");
    }

    const { bookingId } = req.params;
    const { bookingStatus, adminNotes } = req.body;

    const validStatuses = ["pending", "confirmed", "cancelled", "rejected", "completed"];
    if (!validStatuses.includes(bookingStatus)) {
        throw new ApiError(400, "Invalid booking status");
    }

    const booking = await Booking.findById(bookingId)
        .populate("mess_id")
        .populate("user_id", "name email");

    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    const session = await Booking.startSession();
    session.startTransaction();

    try {
        const oldStatus = booking.bookingStatus;
        booking.bookingStatus = bookingStatus;
        
        if (adminNotes) {
            booking.adminNotes = adminNotes;
        }

        // Update mess status based on booking status
        if (booking.mess_id) {
            let messStatus = "free";
            
            if (bookingStatus === "confirmed") {
                messStatus = "booked";
            } else if (bookingStatus === "pending") {
                messStatus = "pending";
            } else if (["cancelled", "rejected"].includes(bookingStatus)) {
                messStatus = "free";
            }

            booking.mess_id.status = messStatus;
            booking.mess_id.availability = messStatus === "free";
            await booking.mess_id.save({ session });
        }

        // Send notification emails for status changes
        if (oldStatus !== bookingStatus) {
            try {
                await sendBookingConfirmation(booking.tenantEmail, {
                    tenantName: booking.tenantName,
                    messName: booking.mess_id?.title,
                    address: booking.mess_id?.address,
                    checkInDate: booking.checkInDate,
                    transactionId: booking._id,
                    amount: booking.payAbleAmount,
                    paymentStatus: booking.paymentStatus,
                    bookingStatus: booking.bookingStatus,
                    bookingLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`
                });

                // Notify owner if status changed to confirmed
                if (bookingStatus === "confirmed") {
                    const owner = await User.findById(booking.owner_id);
                    if (owner && owner.email) {
                        await sendOwnerNotification(owner.email, {
                            messName: booking.mess_id?.title,
                            tenantName: booking.tenantName,
                            checkInDate: booking.checkInDate,
                            amount: booking.payAbleAmount,
                            tenantEmail: booking.tenantEmail
                        });
                    }
                }
            } catch (emailError) {
                console.error("Failed to send notification emails:", emailError);
                // Don't throw error, continue with the transaction
            }
        }

        await booking.save({ session });
        await session.commitTransaction();
        session.endSession();

        // Populate for response
        await booking.populate("user_id", "name email phone");
        await booking.populate("owner_id", "name email phone");
        await booking.populate("mess_id", "title address payPerMonth");

        return res.status(200).json(
            new ApiSuccess("Booking status updated successfully", booking)
        );

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
});

// Admin update payment status
const adminUpdatePaymentStatus = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can update payment status.");
    }

    const { bookingId } = req.params;
    const { paymentStatus, transactionId, adminNotes } = req.body;

    const validStatuses = ["pending", "paid", "failed", "refunded"];
    if (!validStatuses.includes(paymentStatus)) {
        throw new ApiError(400, "Invalid payment status");
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    const session = await Booking.startSession();
    session.startTransaction();

    try {
        const oldStatus = booking.paymentStatus;
        booking.paymentStatus = paymentStatus;
        
        if (transactionId) {
            booking.transactionId = transactionId;
        }

        if (adminNotes) {
            booking.adminNotes = adminNotes;
        }

        // If marking as paid, update related statuses
        if (paymentStatus === "paid" && oldStatus !== "paid") {
            booking.paidAt = new Date();
            if (booking.bookingStatus === "pending") {
                booking.bookingStatus = "confirmed";
            }

            // Update mess status
            if (booking.mess_id) {
                const mess = await MessListing.findById(booking.mess_id);
                if (mess) {
                    mess.status = "booked";
                    mess.availability = false;
                    await mess.save({ session });
                }
            }

            // Send payment success email
            try {
                await sendBookingConfirmation(booking.tenantEmail, {
                    tenantName: booking.tenantName,
                    messName: booking.mess_id?.title,
                    address: booking.mess_id?.address,
                    checkInDate: booking.checkInDate,
                    transactionId: booking.transactionId || booking._id,
                    amount: booking.payAbleAmount,
                    paymentStatus: booking.paymentStatus,
                    bookingStatus: booking.bookingStatus,
                    bookingLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`
                });
            } catch (emailError) {
                console.error("Failed to send payment success email:", emailError);
            }
        }

        await booking.save({ session });
        await session.commitTransaction();
        session.endSession();

        // Populate for response
        await booking.populate("user_id", "name email phone");
        await booking.populate("owner_id", "name email phone");
        await booking.populate("mess_id", "title address payPerMonth");

        return res.status(200).json(
            new ApiSuccess("Payment status updated successfully", booking)
        );

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
});

// Admin refund booking
const adminRefundBooking = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can process refunds.");
    }

    const { bookingId } = req.params;
    const { refundAmount, reason } = req.body;

    const booking = await Booking.findById(bookingId)
        .populate("mess_id")
        .populate("user_id", "name email");

    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    if (booking.paymentStatus !== "paid") {
        throw new ApiError(400, "Only paid bookings can be refunded");
    }

    const refundAmt = refundAmount || booking.payAbleAmount;

    const session = await Booking.startSession();
    session.startTransaction();

    try {
        // Update booking status
        booking.paymentStatus = "refunded";
        booking.refundAmount = refundAmt;
        booking.refundReason = reason;
        booking.refundedAt = new Date();
        booking.refundedBy = req.user.id;

        // Update mess status
        if (booking.mess_id) {
            booking.mess_id.status = "free";
            booking.mess_id.availability = true;
            await booking.mess_id.save({ session });
        }

        await booking.save({ session });
        await session.commitTransaction();
        session.endSession();

        // Send refund notification email
        try {
            await sendBookingConfirmation(booking.tenantEmail, {
                tenantName: booking.tenantName,
                messName: booking.mess_id?.title,
                address: booking.mess_id?.address,
                checkInDate: booking.checkInDate,
                transactionId: booking.transactionId || booking._id,
                amount: refundAmt,
                paymentStatus: booking.paymentStatus,
                bookingStatus: booking.bookingStatus,
                refundReason: reason,
                bookingLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`
            });
        } catch (emailError) {
            console.error("Failed to send refund notification email:", emailError);
        }

        return res.status(200).json(
            new ApiSuccess("Booking refunded successfully", {
                bookingId: booking._id,
                refundAmount: refundAmt,
                originalAmount: booking.payAbleAmount,
                reason: reason
            })
        );

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
});

// Get booking by ID for admin
const adminGetBookingById = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can access booking details.");
    }

    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
        .populate("user_id", "name email phone")
        .populate("owner_id", "name email phone")
        .populate("mess_id", "title address payPerMonth facilities images");

    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    return res.status(200).json(
        new ApiSuccess("Booking retrieved successfully", booking)
    );
});

// Delete booking (Admin only)
const adminDeleteBooking = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Access denied. Only admin can delete bookings.");
    }

    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    const session = await Booking.startSession();
    session.startTransaction();

    try {
        // Update mess status to free before deleting booking
        if (booking.mess_id) {
            await MessListing.findByIdAndUpdate(
                booking.mess_id, 
                { 
                    status: "free", 
                    availability: true 
                },
                { session }
            );
        }

        await Booking.findByIdAndDelete(bookingId, { session });
        await session.commitTransaction();
        session.endSession();

        return res.status(200).json(
            new ApiSuccess("Booking deleted successfully")
        );

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw error;
    }
});



export {
    createBooking,
    getUserBookings,
    getOwnerBookings,
    getBookingById,
    updateBookingStatus,
    updatePaymentStatus,
    cancelBooking,
    deleteBooking,
    getAllBookingsAdmin,
    getBookingStatistics,
    adminUpdateBookingStatus,
    adminUpdatePaymentStatus,
    adminRefundBooking,
    adminGetBookingById,
    adminDeleteBooking
};
