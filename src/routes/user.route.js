import express from "express";
const userRouter = express.Router();
import {
    generateResetCode,
    getAllOwners,
    getAllStudents,
    getStudentById,
    login,
    logout,
    register,
    resetPassword,
    verifyResetCode
} from "../controllers/user.controller.js";
import ApiSuccess from "../utils/ApiSuccess.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

userRouter.get("/check-auth", authMiddleware, (req, res) => {
    const user = req.user;
    res.status(200).json(new ApiSuccess("authorize user", user, 200));
});

userRouter.route("/register").post(register);
userRouter.route("/login").post(login);
userRouter.route("/logout").post(logout);
userRouter.route("/forgot-password").post(generateResetCode);
userRouter.route("/verify-code").post(verifyResetCode);
userRouter.route("/reset-password").post(resetPassword);
userRouter.route("/get-student-id/:id").get(authMiddleware, getStudentById);
userRouter.route("/get-owners").get(authMiddleware, getAllOwners);


export default userRouter;
