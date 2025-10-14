import express from "express";
import { upload } from "../middleware/multer.js";
import { authMiddleware } from "../controllers/user.controller.js";
import { addMess, advancedSearchMess,withOutSearchSort, getAllMess, messInfoWithView, messOnlyNotBook, deleteMess } from "../controllers/messListing.controller.js";
import {validateImageCount} from "../middleware/validateImageCount.js"

const messListingRoute = express.Router();

messListingRoute.route("/add").post(
    authMiddleware, // Check if user is authenticated
    upload.array("images", 3), // Accept exactly 3 images
    validateImageCount,
    addMess
);
messListingRoute.route("/delete/:messId").get(
    authMiddleware, // Check if user is authenticated
    deleteMess
);
messListingRoute.route("/get-all-mess").get(getAllMess)
messListingRoute.route("/get-mess-info/:id").get(messInfoWithView)
messListingRoute.route("/get-mess-not-booked").get(messOnlyNotBook)
messListingRoute.route("/get-mess-search-with-sort").get(advancedSearchMess)
messListingRoute.route("/get-mess-sort").get(withOutSearchSort)

export default messListingRoute;
