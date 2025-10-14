import Booking from '../models/Booking.js';
import MessListing from '../models/MessListing.js';
import ApiError from '../utils/ApiError.js';
import ApiSuccess from '../utils/ApiSuccess.js';
import asyncHandler from '../utils/asyncHandler.js';

// Create a new booking
const createBooking = asyncHandler(async (req, res) => {
    const {
        mess_id,
        checkInDate,
        advanceMonths = 1,
        paymentMethod,
        tenantName,
        tenantPhone,
        tenantEmail,
        emergencyContact
    } = req.body;

    // Validate required fields
    if (!mess_id || !checkInDate || !tenantName || !tenantPhone || !tenantEmail) {
        throw new ApiError(400, "All required fields must be provided");
    }

    // Check if mess exists and is available
    const mess = await MessListing.findById(mess_id);
    if (!mess) {
        throw new ApiError(404, "Mess not found");
    }

    if (mess.status === "booked") {
        throw new ApiError(400, "This mess is already booked");
    }

    // Calculate total amount
    const totalAmount = mess.payPerMonth * advanceMonths;

    // Create booking
    const booking = new Booking({
        user_id: req.user._id,
        mess_id,
        owner_id: mess.owner_id,
        checkInDate: new Date(checkInDate),
        totalAmount,
        advanceMonths,
        paymentMethod,
        tenantName,
        tenantPhone,
        tenantEmail,
        emergencyContact,
        bookingStatus: "pending",
        paymentStatus: "pending"
    });

    await booking.save();

    // Populate references for response
    await booking.populate('mess_id', 'title address payPerMonth facilities');
    await booking.populate('owner_id', 'name email phone');

    return res.status(201).json(
        new ApiSuccess("Booking created successfully", booking, 201)
    );
});

// Get all bookings for a user
const getUserBookings = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    let query = { user_id: req.user._id };
    if (status) {
        query.bookingStatus = status;
    }

    const [bookings, totalBookings] = await Promise.all([
        Booking.find(query)
            .populate('mess_id', 'title address images payPerMonth')
            .populate('owner_id', 'name phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Booking.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalBookings / limit);

    return res.status(200).json(
        new ApiSuccess("Bookings retrieved successfully", {
            bookings,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalBookings,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        })
    );
});

// Get all bookings for an owner
const getOwnerBookings = asyncHandler(async (req, res) => {
    if (req.user.role !== "owner") {
        throw new ApiError(403, "Only owners can access this resource");
    }

    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    let query = { owner_id: req.user._id };
    if (status) {
        query.bookingStatus = status;
    }

    const [bookings, totalBookings] = await Promise.all([
        Booking.find(query)
            .populate('user_id', 'name email phone')
            .populate('mess_id', 'title address')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Booking.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalBookings / limit);

    return res.status(200).json(
        new ApiSuccess("Owner bookings retrieved successfully", {
            bookings,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalBookings,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        })
    );
});

// Get single booking by ID
const getBookingById = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
        .populate('user_id', 'name email phone')
        .populate('owner_id', 'name email phone')
        .populate('mess_id', 'title address payPerMonth facilities images');

    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    // Check if user has permission to view this booking
    const isUser = booking.user_id._id.toString() === req.user._id.toString();
    const isOwner = booking.owner_id._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isUser && !isOwner && !isAdmin) {
        throw new ApiError(403, "Access denied to this booking");
    }

    return res.status(200).json(
        new ApiSuccess("Booking retrieved successfully", booking)
    );
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
    if (booking.owner_id.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Only the mess owner can update booking status");
    }

    // Update booking status
    booking.bookingStatus = bookingStatus;
    await booking.save();

    // If booking is confirmed, update mess status
    if (bookingStatus === "confirmed") {
        await MessListing.findByIdAndUpdate(booking.mess_id, { status: "booked" });
    }

    // If booking is cancelled or rejected, make mess available again
    if (bookingStatus === "cancelled" || bookingStatus === "rejected") {
        await MessListing.findByIdAndUpdate(booking.mess_id, { status: "free" });
    }

    await booking.populate('user_id', 'name email');
    await booking.populate('mess_id', 'title');

    return res.status(200).json(
        new ApiSuccess(`Booking ${bookingStatus} successfully`, booking)
    );
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
    const isUser = booking.user_id.toString() === req.user._id.toString();
    const isOwner = booking.owner_id.toString() === req.user._id.toString();
    
    if (!isUser && !isOwner) {
        throw new ApiError(403, "Access denied to update payment status");
    }

    booking.paymentStatus = paymentStatus;
    if (transactionId) {
        booking.transactionId = transactionId;
    }

    await booking.save();

    return res.status(200).json(
        new ApiSuccess("Payment status updated successfully", booking)
    );
});

// Cancel booking (User only)
const cancelBooking = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }

    // Check if user owns this booking
    if (booking.user_id.toString() !== req.user._id.toString()) {
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

    return res.status(200).json(
        new ApiSuccess("Booking cancelled successfully", booking)
    );
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

    return res.status(200).json(
        new ApiSuccess("Booking deleted successfully")
    );
});

export {
    createBooking,
    getUserBookings,
    getOwnerBookings,
    getBookingById,
    updateBookingStatus,
    updatePaymentStatus,
    cancelBooking,
    deleteBooking
};