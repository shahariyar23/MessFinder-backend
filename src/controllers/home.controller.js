import fs from "fs";
import HomePage from "../models/home.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiSuccess from "../utils/ApiSuccess.js";
import asyncHandler from "../utils/asyncHandler.js";
import { deleteFromCloudinary, uploadToCloudinary } from "../utils/cloudinary.js";

//  ADD HOME SLIDER
const homePageAddSlider = asyncHandler(async (req, res) => {
  const file = req.file;

  const user = await User.findById(req.user.id);
  if (!user || user.role !== "admin") {
    throw new ApiError(403, "Only admin can update home page slider");
  }

  const { title, description, buttonText, buttonLink } = req.body;

  if (!title || !description || !buttonText) {
    throw new ApiError(400, "All fields are required");
  }

  if (!file) {
    throw new ApiError(400, "Image is required");
  }

  const uploaded = await uploadToCloudinary(file.path);

  const slide = await HomePage.create({
    title: title.trim(),
    description: description.trim(),
    buttonText: buttonText.trim(),
    buttonLink: buttonLink?.trim() || "/mess/listing",
    backgroundImage: {
      url: uploaded.secure_url,
      public_id: uploaded.public_id,
    },
  });

  // 🧹 cleanup
  if (fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }

  return res.status(201).json(
    new ApiSuccess("Home page slider saved successfully", slide, 201)
  );
});

//  GET HOME SLIDER
const getAllHomePageSlider = asyncHandler(async (req, res) => {
  const slider = await HomePage.find().lean();

  return res.status(200).json(
    new ApiSuccess("Slider fetched successfully", slider, 200)
  );
});
// delete slider with cloudinary image
const deleteHomeSlider = asyncHandler(async (req, res) => {
  const { id } = req.params;

  //  Admin check
  const user = await User.findById(req.user.id);
  if (!user || user.role !== "admin") {
    throw new ApiError(403, "Only admin can delete home slider");
  }

  //  Find slide
  const slide = await HomePage.findById(id);
  if (!slide) {
    throw new ApiError(404, "Home slider not found");
  }

  //  Delete image from Cloudinary (safe)
  if (slide.backgroundImage?.public_id) {
    try {
      await deleteFromCloudinary(slide.backgroundImage.public_id);
    } catch (err) {
      console.error(
        " Failed to delete Cloudinary image:",
        slide.backgroundImage.public_id,
        err
      );
      //  Do NOT block deletion if Cloudinary fails
    }
  }

  //  Delete from database
  await HomePage.findByIdAndDelete(id);

  return res.status(200).json(
    new ApiSuccess("Home slider deleted successfully", null, 200)
  );
});


export {
  homePageAddSlider,
  getAllHomePageSlider,
  deleteHomeSlider
};
