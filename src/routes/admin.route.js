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
import { getAllPaymentsAdmin, getPaymentStatistics, refundPayment, updatePaymentStatus } from "../controllers/payment.controller.js";
import { adminDeleteBooking, adminGetBookingById, adminRefundBooking, adminUpdateBookingStatus, adminUpdatePaymentStatus, getAllBookingsAdmin, getBookingStatistics } from "../controllers/booking.controller.js";
import { deleteHomeSlider, getAllHomePageSlider, homePageAddSlider } from "../controllers/home.controller.js";
import { upload } from "../middleware/multer.js";


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


adminRoute.route('/payment/all').get(authMiddleware, getAllPaymentsAdmin);
adminRoute.route('/payment/statistics').get(authMiddleware, getPaymentStatistics);
adminRoute.route('/payment/:bookingId/status').put( authMiddleware, updatePaymentStatus);
adminRoute.route('/payment/:bookingId/refund').post( authMiddleware, refundPayment);


// admin/booking/all
adminRoute.route('/booking/all').get(authMiddleware, getAllBookingsAdmin);
adminRoute.route('/booking/statistics').get( authMiddleware, getBookingStatistics);
adminRoute.route("/booking/:bookingId").get(authMiddleware, adminGetBookingById);
adminRoute.route("/booking/:bookingId/status").put(authMiddleware, adminUpdateBookingStatus);
adminRoute.route("/booking/:bookingId/payment-status").put( authMiddleware, adminUpdatePaymentStatus);
adminRoute.route("/booking/:bookingId/refund").post( authMiddleware, adminRefundBooking);
adminRoute.route("/booking/:bookingId").delete(authMiddleware, adminDeleteBooking);






adminRoute.route('/home-page-slider').post(authMiddleware, 
    upload.single("image"), 
    homePageAddSlider);
adminRoute.route('/get-home-page-slider').get(getAllHomePageSlider);
adminRoute.route('/home-slider-delete/:id').delete(authMiddleware, deleteHomeSlider);


export default adminRoute;