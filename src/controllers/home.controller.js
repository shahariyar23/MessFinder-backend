import HomePage from "../models/home.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiSuccess from "../utils/ApiSuccess.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";


// add home slider images
const homePageAddSlider = asyncHandler(async (req, res) => {
  const uploadedFiles = req.files || [];

  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== "admin") {
      throw new ApiError(403, "Only admin can update home page slider");
    }

    const slides = req.body.slides;
    if (!slides || typeof slides !== "object") {
      throw new ApiError(400, "Slides data is required");
    }

    const slideArray = Object.values(slides);

    if (slideArray.length === 0) {
      throw new ApiError(400, "At least one slide is required");
    }

    // 🔥 Remove old sliders (replace strategy)
    await HomePage.deleteMany({});

    const savedSlides = [];

    for (let i = 0; i < slideArray.length; i++) {
      const slide = slideArray[i];

      const { title, description, buttonText, buttonLink } = slide;

      if (!title || !description || !buttonText || !buttonLink) {
        throw new ApiError(400, "All slide fields are required");
      }

      const file = uploadedFiles.find((f) =>
        f.fieldname === `slides[${i}][image]`
      );

      if (!file) {
        throw new ApiError(400, `Image missing for slide ${i + 1}`);
      }

      // ☁️ Upload to Cloudinary
      const uploaded = await uploadToCloudinary(file.path);

      const newSlide = await HomePage.create({
        title: title.trim(),
        description: description.trim(),
        buttonText: buttonText.trim(),
        buttonLink: buttonLink.trim(),
        backgroundImage: {
          url: uploaded.secure_url,
          public_id: uploaded.public_id,
        },
      });

      savedSlides.push(newSlide);
    }

    // 🧹 Clean temp files
    uploadedFiles.forEach((file) => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    });

    return res.status(201).json(
      new ApiSuccess("Home slider updated successfully", savedSlides, 201)
    );
  } catch (error) {
    uploadedFiles.forEach((file) => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    });
    throw error;
  }
});



const getAllHomePageSlider = asyncHandler(async(req, res)=>{
    const slider = await HomePage.find().lean();
    return new ApiSuccess("Skider get successfully", slider, 200)
})

export {
    homePageAddSlider,
    getAllHomePageSlider
}