import express from "express";
const userRouter = express.Router();
import { authMiddleware, generateResetCode, login, logout, register, resetPassword, verifyResetCode } from "../controllers/user.controller.js";
import ApiSuccess from "../utils/ApiSuccess.js";

userRouter.get("/check-auth", authMiddleware, (req, res) => {
  const user = req.user;
  res.status(200).json(new ApiSuccess("authorize user", user, 200));
});
userRouter.post("/register", register);
userRouter.post("/login", login);
userRouter.post("/logout", logout);
userRouter.post("/forgot-password", generateResetCode);
userRouter.post("/verfiy-code", verifyResetCode);
userRouter.post("/reset-password", resetPassword);

export default userRouter;