import express from "express";
import {
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
} from "../controllers/admin.controller.js";
import { authMiddleware } from "../middleware/authMiddleware.js";


const adminRoute = express.Router();



adminRoute.route("/delete-owner/:ownerId").delete(authMiddleware, deleteOwner);
adminRoute.route("/get-all-mess").get(authMiddleware, getAllMess);
adminRoute.route("/delete-user/:userId").delete(authMiddleware, deleteUser);
adminRoute.route("/modify-user/:userId").put(authMiddleware, modifyUser);
adminRoute.route("/modify-owner/:ownerId").put(authMiddleware, modifyOwner);
adminRoute.route("/delete-mess/:messId").delete(authMiddleware, deleteMess);
adminRoute.route("/update-mess/:messId").patch(authMiddleware, updateMess);
adminRoute.route("/get-user-statistics").get(authMiddleware, getUserStatistics);
adminRoute.route("/get-users").get(authMiddleware, getAllUsers);
adminRoute.route("/get-user-bulk-activity").post(authMiddleware, bulkUserActions);

export default adminRoute;