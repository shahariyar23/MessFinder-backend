import express from "express";

import { authMiddleware } from "../middleware/authMiddleware.js";
import { addRequest, getAllRequests, getRequestDetails, updateRequestStatus, getMyRequests } from "../controllers/requestMessView.controller.js";


const requestRoute = express.Router();

requestRoute.route("/add/:messId").get(authMiddleware, addRequest);
requestRoute.route("/get-all-request/:ownerId").get(authMiddleware, getAllRequests);
requestRoute.route("/get-all-request-user").get(authMiddleware, getMyRequests);
requestRoute.route("/update/:requestId").put(authMiddleware, updateRequestStatus);
requestRoute.route("/get-details/:requestId").get(authMiddleware, getRequestDetails);



export default requestRoute;
