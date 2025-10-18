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

bookingRoute.route("/create-booking").post(authMiddleware, createBooking);
bookingRoute.route("/get-user-booking").get(authMiddleware, getUserBookings);
bookingRoute.route("/get-owner-booking/:ownerId").get(authMiddleware, getOwnerBookings);
bookingRoute.route("/get-booking-info/:bookingId").get(authMiddleware, getBookingById);
bookingRoute.route("/update-booking-status/:bookingId").post(authMiddleware, updateBookingStatus);
bookingRoute.route("/update-booking-payment-status/:bookingId").post(authMiddleware, updatePaymentStatus);
bookingRoute.route("/cancel-booking/:bookingId").get(authMiddleware, cancelBooking);
bookingRoute.route("/delete-booking/:bookingId").get(authMiddleware, deleteBooking);

export default bookingRoute;
