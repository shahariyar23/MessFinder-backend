import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
    createBooking,
    getUserBookings,
    getOwnerBookings,
    getBookingById,
    updateBookingStatus,
    updatePaymentStatus,
    cancelBooking,
    deleteBooking,
} from "../controllers/booking.controller.js";

const bookingRoute = express.Router();

// Create booking
bookingRoute.post("/create-booking", authMiddleware, createBooking);

// Get user bookings with filtering
bookingRoute.get("/get-user-booking", authMiddleware, getUserBookings);

// Get owner bookings with filtering
bookingRoute.get("/get-owner-booking/:ownerId", authMiddleware, getOwnerBookings);

// Get single booking by ID
bookingRoute.get("/get-booking-info/:bookingId", authMiddleware, getBookingById);

// Update booking status (Owner only)
bookingRoute.patch("/update-booking-status/:bookingId", authMiddleware, updateBookingStatus);

// Update payment status
bookingRoute.patch("/update-booking-payment-status/:bookingId", authMiddleware, updatePaymentStatus);

// Cancel booking (User only)
bookingRoute.patch("/cancel-booking/:bookingId", authMiddleware, cancelBooking);

// Delete booking (Admin only)
bookingRoute.delete("/delete-booking/:bookingId", authMiddleware, deleteBooking);

export default bookingRoute;