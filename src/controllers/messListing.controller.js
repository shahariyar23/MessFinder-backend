import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiSuccess from "../utils/ApiSuccess.js";
import MessListing from "../models/messListing.model.js";
import {
    deleteFromCloudinary,
    uploadToCloudinary,
} from "../utils/cloudinary.js";
import mongoose from "mongoose";

const addMess = asyncHandler(async (req, res) => {
    const {
        title,
        description,
        address,
        availableFrom,
        advancePaymentMonth = 1,
        payPerMonth,
        facilities = [],
        roomType,
        roomFeatures,
        genderPreference,
        contact,
        owner_id,
    } = req.body;

    // Validation checks
    const errors = [];

    if (!title?.trim()) errors.push("Title is required");
    if (!description?.trim()) errors.push("Description is required");
    if (description?.trim().length < 6)
        errors.push("Description must be at least 6 characters");
    if (!address?.trim()) errors.push("Address is required");
    if (!availableFrom) errors.push("Available from date is required");
    if (!payPerMonth) errors.push("Pay per month is required");
    if (!roomType) errors.push("Room type is required");
    if (!roomFeatures) errors.push("Room features are required");
    if (!genderPreference) errors.push("Gender preference is required");
    if (!contact?.trim()) errors.push("Contact information is required");

    // Check if user is owner
    if (req.user.role !== "owner") {
        throw new ApiError(403, "Only owners can create mess listings");
    }

    // Validate images
    if (!req.files || req.files.length !== 3) {
        throw new ApiError(400, "Exactly 3 images are required");
    }

    // Upload each image to Cloudinary
    const imageUploadPromises = req.files.map((file) =>
        uploadToCloudinary(file.path)
    );

    const cloudinaryResults = await Promise.all(imageUploadPromises);

    // Create array of objects with url and public_id
    const images = cloudinaryResults.map((result) => ({
        url: result.secure_url,
        public_id: result.public_id,
    }));

    // Check if all uploads were successful
    const failedUploads = cloudinaryResults.filter((result) => !result);
    if (failedUploads.length > 0) {
        throw new ApiError(500, "Some images failed to upload");
    }

    // Parse facilities
    let facilitiesArray = facilities;
    if (typeof facilities === "string") {
        try {
            facilitiesArray = JSON.parse(facilities);
        } catch (parseError) {
            throw new ApiError(400, "Invalid facilities format");
        }
    }

    // Create new mess listing
    const newMess = new MessListing({
        title: title.trim(),
        description: description.trim(),
        owner_id,
        address: address.trim(),
        availableFrom: new Date(availableFrom),
        advancePaymentMonth: parseInt(advancePaymentMonth) || 1,
        payPerMonth: parseFloat(payPerMonth),
        facilities: facilitiesArray,
        roomType,
        roomFeatures,
        genderPreference,
        contact: contact.trim(),
        image: images, // This will be the array of 3 image paths
        status: "free",
    });

    await newMess.save();

    // Populate owner info
    await newMess.populate("owner_id", "name email phone");

    // Images are successfully saved, DO NOT delete them
    return res
        .status(201)
        .json(
            new ApiSuccess("Mess listing created successfully", newMess, 201)
        );
});

const deleteMess = asyncHandler(async(req, res) => {
    const { messId } = req.params;

    // Find the mess first to check ownership
    const mess = await MessListing.findById(messId);
    
    if (!mess) {
        throw new ApiError(404, "Mess not found");
    }

    // Check if owner_id exists and then compare
    if (!mess.owner_id) {
        throw new ApiError(400, "Mess owner information is missing");
    }
    // Safe comparison
    if (mess.owner_id && !mess.owner_id.equals(req.user.id)) {
        throw new ApiError(403, "You can only delete your own mess listings");
    }

    // Delete the mess
    await MessListing.findByIdAndDelete(messId);

    // Delete images from Cloudinary
    if (mess.image && mess.image.length > 0) {
        const deletePromises = mess.image.map(img => 
            deleteFromCloudinary(img.public_id)
        );
        await Promise.all(deletePromises);
    }

    return res.status(200).json(
        new ApiSuccess("Mess deleted successfully")
    );
});

const getAllMess = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // ✅ Add await to execute the query
    const allMess = await MessListing.find()
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate("owner_id", "name email phone") // Optional: populate owner
        .lean(); // Optional: for better performance

    const totalMess = await MessListing.countDocuments();
    const totalPages = Math.ceil(totalMess / limit);

    return res.status(200).json(
        new ApiSuccess("Mess listing retrieved successfully", {
            allMess, // ✅ Now this contains actual data, not a query object
            pagination: {
                currentPage: page,
                totalPages,
                totalMess,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        })
    );
});

const messInfoWithView = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const mess = await MessListing.findByIdAndUpdate(
        id,
        { $inc: { view: 1 } }, // Increment view count by 1
        { new: true } // Return updated document
    )
        .populate("owner_id", "name email phone")
        .lean();

    if (!mess) {
        throw new ApiError(404, "Mess not found");
    }

    return res
        .status(200)
        .json(new ApiSuccess("Mess retrieved successfully", mess));
});

const messOnlyNotBook = asyncHandler(async (req, res) => {
    const mess = await MessListing.find({
        status: { $ne: "booked" }, // Not booked
    }).populate("owner_id", "name email phone");

    if (!mess) {
        throw new ApiError(404, "Mess not found or already booked");
    }

    return res
        .status(200)
        .json(new ApiSuccess("Mess retrieved successfully", mess));
});

const advancedSearchMess = asyncHandler(async (req, res) => {
    const {
        search,
        sortBy = "price",
        sortOrder = "desc",
        page = 1,
        limit = 10,
    } = req.query;

    const skip = (page - 1) * limit;

    // Build query
    let query = {};
    if (search) {
        query.$or = [
            { title: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
        ];
    }

    // Define sort options based on sortBy parameter
    let sortOptions = {};

    switch (sortBy) {
        case "price":
            sortOptions.payPerMonth = sortOrder === "asc" ? 1 : -1;
            break;
        case "date":
            sortOptions.createdAt = sortOrder === "asc" ? 1 : -1;
            break;
        case "rating":
            sortOptions.review = sortOrder === "asc" ? 1 : -1;
            break;
        default:
            sortOptions.createdAt = -1; // Default sort by newest
    }

    // Execute queries
    const [messes, totalMesses] = await Promise.all([
        MessListing.find(query)
            .populate("owner_id", "name email phone")
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        MessListing.countDocuments(query),
    ]);

    const totalPages = Math.ceil(totalMesses / limit);

    return res.status(200).json(
        new ApiSuccess("Messes retrieved successfully", {
            messes,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalMesses,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
            filters: {
                search: search || "",
                sortBy,
                sortOrder,
            },
        })
    );
});

const withOutSearchSort = asyncHandler(async (req, res) => {
    const {
        sortBy = "price",
        sortOrder = "desc",
        page = 1,
        limit = 10,
    } = req.query;

    const skip = (page - 1) * limit;

    // Define sort options based on sortBy parameter
    let sortOptions = {};

    switch (sortBy) {
        case "price":
            sortOptions.payPerMonth = sortOrder === "asc" ? 1 : -1;
            break;
        case "date":
            sortOptions.createdAt = sortOrder === "asc" ? 1 : -1;
            break;
        case "rating":
            sortOptions.review = sortOrder === "asc" ? 1 : -1;
            break;
        default:
            sortOptions.createdAt = -1; // Default sort by newest
    }

    // Execute queries
    const [messes, totalMesses] = await Promise.all([
        MessListing.find()
            .populate("owner_id", "name email phone")
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        MessListing.countDocuments(),
    ]);

    const totalPages = Math.ceil(totalMesses / limit);

    return res.status(200).json(
        new ApiSuccess("Messes retrieved successfully", {
            messes,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalMesses,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
            filters: {
                sortBy,
                sortOrder,
            },
        })
    );
});

export {
    addMess,
    messInfoWithView,
    messOnlyNotBook,
    getAllMess,
    advancedSearchMess,
    withOutSearchSort,
    deleteMess,
};
