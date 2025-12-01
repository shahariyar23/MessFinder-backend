// utils/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configure Cloudinary
cloudinary.config({
    cloud_name: "mostakshahariyar",
    api_key: "548443337817757",
    api_secret: "HSIW6TuOs2Ci3yIjt7jsBdNmDp8"
});

// Function to upload file to Cloudinary
const uploadToCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        
        // Upload the file to Cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            folder: "mess-listings"
        });
        
        // File has been uploaded successfully
        //console.log("File uploaded to Cloudinary:", response.url);
        
        // Remove locally saved temporary file
        fs.unlinkSync(localFilePath);
        
        return response;
    } catch (error) {
        // Remove locally saved temporary file if upload failed
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        console.error("Cloudinary upload error:", error);
        return null;
    }
};

// Function to delete from Cloudinary
const deleteFromCloudinary = async (publicId) => {
    try {
        await cloudinary.uploader.destroy(publicId);
        //console.log("Deleted from Cloudinary:", publicId);
    } catch (error) {
        console.error("Cloudinary delete error:", error);
    }
};

export { cloudinary, uploadToCloudinary, deleteFromCloudinary };