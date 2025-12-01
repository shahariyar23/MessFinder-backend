// models/savedMess.model.js
import mongoose from "mongoose";

const savedMessSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  messId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MessListing",
    required: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  savedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to ensure unique user-mess combination
savedMessSchema.index({ userId: 1, messId: 1 }, { unique: true });

export const SavedMess = mongoose.model("SavedMess", savedMessSchema);