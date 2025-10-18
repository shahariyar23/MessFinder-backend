// routes/savedMess.route.js
import express from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import {
  saveMess,
  unsaveMess,
  getSavedMesses,
  checkMessSaved
} from "../controllers/saveMess.controller.js";

const saveRouter = express.Router();

saveRouter.route("/get-all")
  .get(authMiddleware, getSavedMesses);

saveRouter.route("/add/:messId").post(authMiddleware, saveMess)
saveRouter.route("/delete/:messId").delete(authMiddleware, unsaveMess)
saveRouter.route("/check/:messId").get(authMiddleware, checkMessSaved);

export default saveRouter;