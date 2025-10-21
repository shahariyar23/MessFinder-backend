import express from "express";

import {
    createReview,
    getMessReviews,
    getUserReviews,
    getReviewById,
    updateReview,
    deleteReview,
    reportReview,
    getMessReviewStats,
    getUserReviewStatus,
} from "../controllers/review.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const reviewRoute = express.Router();

reviewRoute.route("/create-review").post(authMiddleware, createReview);
reviewRoute.route("/get-review-mess/:messId").get(authMiddleware, getMessReviews);
reviewRoute.route("/get-review-user").get(authMiddleware, getUserReviewStatus);
reviewRoute.route("/get-review-id/:reviewId").get(authMiddleware, getReviewById);
reviewRoute.route("/update-review-id/:reviewId").post(authMiddleware, updateReview);
reviewRoute.route("/delete-review-id/:reviewId").get(authMiddleware, deleteReview);
reviewRoute.route("/report-review-id/:reviewId").get(authMiddleware, reportReview);
reviewRoute.route("/get-reviewstatuts-mess/:messId").get(authMiddleware, getMessReviewStats);



export default reviewRoute;