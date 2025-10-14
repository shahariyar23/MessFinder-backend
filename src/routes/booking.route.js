import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { createBooking } from "../controllers/booking.controller.js";
const bookingRoute = express.Router();


bookingRoute.route("/create-booking").post(authMiddleware, createBooking);


export default bookingRoute;
