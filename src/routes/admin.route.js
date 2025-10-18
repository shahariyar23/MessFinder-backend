import express from "express";
import {
    deleteOwner,
    deleteUser,
    modifyOwner,
    modifyUser,
    getUserStatistics,
    bulkUserActions
} from "../controllers/admin.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";


const adminRoute = express.Router();



adminRoute.route("/delete-owner/:ownerId").get(authMiddleware, deleteOwner);
adminRoute.route("/delete-user/:userId").get(authMiddleware, deleteUser);
adminRoute.route("/modify-user/:userId").post(authMiddleware, modifyUser);
adminRoute.route("/modify-owner/:ownerId").post(authMiddleware, modifyOwner);
adminRoute.route("/get-user-statistics").get(authMiddleware, getUserStatistics);
adminRoute.route("/get-user-bulk-activity").post(authMiddleware, bulkUserActions);

export default adminRoute;