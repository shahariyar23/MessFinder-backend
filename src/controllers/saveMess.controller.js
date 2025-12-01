// controllers/savedMess.controller.js
import { SavedMess } from "../models/savemess.model.js";
import MessListing from "../models/messListing.model.js";
import ApiError from "../utils/ApiError.js";
import ApiSuccess from "../utils/ApiSuccess.js";
import asyncHandler from "../utils/asyncHandler.js";

// Save a mess
const saveMess = asyncHandler(async (req, res) => {
  const { messId } = req.params;
  const userId = req.user.id;

  // Check if mess exists and get ownerId
  const mess = await MessListing.findById(messId);
  if (!mess) {
    throw new ApiError(404, "Mess not found");
  }
    const ownerId = mess.owner_id;

  // Check if already saved
  const existingSave = await SavedMess.findOne({ userId, messId });
  if (existingSave) {
    throw new ApiError(400, "Mess already saved");
  }

  // Save the mess with ownerId
  const savedMess = new SavedMess({ 
    userId, 
    messId, 
    ownerId 
  });
  await savedMess.save();

  return res.status(201).json(
    new ApiSuccess("Mess saved successfully", { savedMess }, 201)
  );
});

// Unsave a mess
const unsaveMess = asyncHandler(async (req, res) => {
  const { messId } = req.params;
  const userId = req.user.id;

  const result = await SavedMess.findOneAndDelete({ userId, messId });

  if (!result) {
    throw new ApiError(404, "Saved mess not found");
  }

  return res.status(200).json(
    new ApiSuccess("Mess unsaved successfully", null, 200)
  );
});

// Get user's saved messes
const getSavedMesses = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 10 } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  const skip = (pageNum - 1) * limitNum;

  const savedMesses = await SavedMess.find({ userId })
    .populate({
      path: 'messId',
      select: 'title location address image payPerMonth facilities roomType genderPreference contact owner_id'
    })
    .populate({
      path: 'ownerId',
      select: 'name email phone ' // Populate owner details if needed
    })
    .sort({ savedAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  const totalSaved = await SavedMess.countDocuments({ userId });

  // Format the response to handle image structure and include owner info
  const formattedMesses = savedMesses.map(item => ({
    id: item._id,
    mess: {
      ...item.messId,
      // Extract image URLs from the image array
      images: item.messId?.image?.map(img => img.url) || []
    },
    owner: item.ownerId, // Include owner information
    savedAt: item.savedAt,
  }));

  const totalPages = Math.ceil(totalSaved / limitNum);

  return res.status(200).json(
    new ApiSuccess("Saved messes fetched successfully", {
      savedMesses: formattedMesses,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalSaved,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        limit: limitNum
      }
    }, 200)
  );
});

// Get saved messes by owner (for mess owners to see who saved their messes)
const getSavedMessesByOwner = asyncHandler(async (req, res) => {
  const ownerId = req.user.id; // Assuming the owner is making the request
  const { page = 1, limit = 10 } = req.query;

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  const skip = (pageNum - 1) * limitNum;

  const savedMesses = await SavedMess.find({ ownerId })
    .populate({
      path: 'messId',
      select: 'title location address image payPerMonth'
    })
    .populate({
      path: 'userId',
      select: 'name email phone avatar' // User who saved the mess
    })
    .sort({ savedAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  const totalSaved = await SavedMess.countDocuments({ ownerId });

  // Format the response
  const formattedMesses = savedMesses.map(item => ({
    id: item._id,
    mess: {
      ...item.messId,
      images: item.messId?.image?.map(img => img.url) || []
    },
    user: item.userId, // User who saved the mess
    savedAt: item.savedAt,
  }));

  const totalPages = Math.ceil(totalSaved / limitNum);

  return res.status(200).json(
    new ApiSuccess("Saved messes by users fetched successfully", {
      savedMesses: formattedMesses,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalSaved,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        limit: limitNum
      }
    }, 200)
  );
});

// Check if mess is saved by user
const checkMessSaved = asyncHandler(async (req, res) => {
  const { messId } = req.params;
  const userId = req.user.id;

  const saved = await SavedMess.findOne({ userId, messId });

  return res.status(200).json(
    new ApiSuccess("Check completed", {
      isSaved: !!saved,
      savedItem: saved
    }, 200)
  );
});

// Bulk check which messes are saved by user
const bulkCheckSavedMesses = asyncHandler(async (req, res) => {
  const { messIds } = req.body; // Array of mess IDs
  const userId = req.user.id;

  if (!messIds || !Array.isArray(messIds)) {
    throw new ApiError(400, "Please provide an array of mess IDs");
  }

  const savedMesses = await SavedMess.find({
    userId,
    messId: { $in: messIds }
  });

  // Create a map of saved mess IDs for quick lookup
  const savedMessMap = {};
  savedMesses.forEach(item => {
    savedMessMap[item.messId.toString()] = true;
  });

  // Return which messes are saved
  const result = messIds.map(messId => ({
    messId,
    isSaved: !!savedMessMap[messId]
  }));

  return res.status(200).json(
    new ApiSuccess("Bulk check completed", {
      savedStatus: result
    }, 200)
  );
});

export {
  saveMess,
  unsaveMess,
  getSavedMesses,
  getSavedMessesByOwner,
  checkMessSaved,
  bulkCheckSavedMesses
};