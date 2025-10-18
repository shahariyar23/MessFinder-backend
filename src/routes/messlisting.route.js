import express from "express";
import { upload } from "../middleware/multer.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { addMess, advancedSearchMess,withOutSearchSort, getAllMess, messInfoWithView, messOnlyNotBook, deleteMess, updateMess } from "../controllers/messListing.controller.js";
import {validateImageCount} from "../middleware/validateImageCount.js"

const messListingRoute = express.Router();

messListingRoute.route("/add").post(
    authMiddleware, // Check if user is authenticated
    upload.array("images", 3), // Accept exactly 3 images
    validateImageCount,
    addMess
);
messListingRoute.route("/delete/:messId").delete(
    authMiddleware, // Check if user is authenticated
    deleteMess
);
messListingRoute.route("/get-all-mess").get(getAllMess)
messListingRoute.route("/update-mess/:messId").put(authMiddleware, updateMess)
messListingRoute.route("/get-mess-info/:id").get(authMiddleware, messInfoWithView)
messListingRoute.route("/get-mess-not-booked").get(messOnlyNotBook)
messListingRoute.route("/get-mess-search-with-sort").get(advancedSearchMess)
messListingRoute.route("/get-mess-sort").get(withOutSearchSort)

export default messListingRoute;
