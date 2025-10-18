import express from "express";
const ownerRoute = express.Router();
import ApiSuccess from "../utils/ApiSuccess.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { getMessesByOwnerId, updateMessStatus } from "../controllers/owner.conteroller.js";

ownerRoute.get("/check-auth", authMiddleware, (req, res) => {
    const user = req.user;
    res.status(200).json(new ApiSuccess("authorize user", user, 200));
});

ownerRoute.route("/get-all-messes/:ownerId").get(authMiddleware, getMessesByOwnerId);
ownerRoute.route("/update-mess-status").post(authMiddleware, updateMessStatus);



export default ownerRoute;
