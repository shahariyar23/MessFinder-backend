import HomePage from "../models/home.model";
import User from "../models/user.model";
import ApiError from "../utils/ApiError";
import ApiSuccess from "../utils/ApiSuccess";
import asyncHandler from "../utils/asyncHandler";
import { uploadToCloudinary } from "../utils/cloudinary";


// add home slider images
const homePageAddSlider = asyncHandler(async (req, res) => {
    // Store reference to uploaded files for cleanup
    const uploadedFiles = req.files || [];
    let cloudinaryPublicIds = []; // To track uploaded cloudinary images for cleanup

    try {
        const {
            title,
            description,
            buttonText,
            buttonLink
        } = req.body;
        const user = await User.findById(req.user.id)
        if(user.isActive !== true){
            throw new ApiError(400, `${user.name} is suspended. Your are not adding any mess`)
        }
        // Validation checks
        const errors = [];

        if (!title?.trim()) errors.push("Title is required");
        if (!description?.trim()) errors.push("Description is required");
        if (description?.trim().length < 6)
            errors.push("Description must be at least 6 characters");
        if (!buttonLink?.trim()) errors.push("Button link is required");
        if (!buttonText) errors.push("Button text e is required");
       
        if (errors.length > 0) {
            //console.log("Validation errors:", errors);
            throw new ApiError(400, errors.join(", "));
        }

        // Check if user is owner
        if (user?.role !== "admin") {
            //console.log("User is not owner, role:", req.user.role);
            throw new ApiError(403, "Only Admin can create Home slider");
        }

        // Validate images
        if (!req.files || req.files.length === 0) {
            //console.log("No files received");
            throw new ApiError(400, "At least one image is required");
        }


        // Check if files are valid images
        const invalidFiles = req.files.filter(file => !file.mimetype.startsWith('image/'));
        if (invalidFiles.length > 0) {
            //console.log("Invalid files detected:", invalidFiles);
            throw new ApiError(400, "Only image files are allowed");
        }

        //console.log("Uploading images to Cloudinary...");

        // Upload each image to Cloudinary
        const imageUploadPromises = req.files.map((file) => {
            //console.log(`Uploading file: ${file.path}`);
            return uploadToCloudinary(file.path);
        });

        const cloudinaryResults = await Promise.all(imageUploadPromises);
        //console.log("Cloudinary results:", cloudinaryResults);

        // Check for failed uploads
        const failedUploads = cloudinaryResults.filter((result) => !result || !result.secure_url);
        if (failedUploads.length > 0) {
            //console.log("Failed uploads:", failedUploads);
            throw new ApiError(500, "Some images failed to upload to Cloudinary");
        }

        // Extract public_ids for cleanup
        cloudinaryPublicIds = cloudinaryResults.map(result => result.public_id);

        // Create array of objects with url and public_id
        const images = cloudinaryResults.map((result) => ({
            url: result.secure_url,
            public_id: result.public_id,
        }));


        // Create new mess listing
        const newHomeSlider = new HomePage({
            title: title.trim(),
            description: description.trim(),
            buttonLink: buttonLink.trim(),
            buttonText: buttonText.trim(),
            backgroundImage: {
                url: images.url,
                public_id: images.publicId
            }
        });

        //console.log("Saving to database...");
        await newMess.save();
        req.files.forEach(file => {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
                //console.log("Cleaned up file:", file.path);
            }
        });

        //console.log("Sending success response...");
        return res.status(201).json(
            new ApiSuccess("Home Slider created successfully", newMess, 201)
        );

    } catch (error) {
        // Cleanup procedure on error
        try {
            // Clean up uploaded files from server
            uploadedFiles.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                    console.log("Cleaned up file on error:", file.path);
                }
            });

            // Clean up Cloudinary images if any were uploaded
            if (cloudinaryPublicIds.length > 0) {
                console.log("Cleaning up Cloudinary images on error:", cloudinaryPublicIds);
                const deletePromises = cloudinaryPublicIds.map(publicId => {
                    return new Promise((resolve) => {
                        cloudinary.uploader.destroy(publicId, (error, result) => {
                            if (error) {
                                console.error(`Failed to delete Cloudinary image ${publicId}:`, error);
                            } else {
                                console.log(`✅ Cleaned up Cloudinary image: ${publicId}`);
                            }
                            resolve();
                        });
                    });
                });
                await Promise.all(deletePromises);
            }
        } catch (cleanupError) {
            console.error("Error during cleanup:", cleanupError);
        }

        // Re-throw the original error to maintain existing response behavior
        throw error;
    }
});

export {
    homePageAddSlider
}