import mongoose from "mongoose";
import MessListing from "../models/messListing.model.js";
import RequesteMessView from "../models/requistMessView.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiSuccess from "../utils/ApiSuccess.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendRequestStatusUpdateToOwner, sendStatusUpdateEmail } from "../utils/service/emailService.js";

const addRequest = asyncHandler(async (req, res) => {
    const { messId } = req.params;
    const { ownerId } = req.query;
    const userId = req.user.id;

    console.log(userId, "ownerId", ownerId, "Mess id:", messId);

    // Check if mess exists
    const mess = await MessListing.findById(messId);
    if (!mess) {
        throw new ApiError(403, "Mess is not found!");
    }

    // Verify owner
    if (mess?.owner_id.toString() !== ownerId.toString()) {
        throw new ApiError(403, "Owner is not found");
    }

    // Check if user exists and is active
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(403, "User not found");
    }
    if (!user?.isActive) {
        throw new ApiError(
            400,
            "User is not active please reset your password"
        );
    }

    // Check if user already has a pending or accepted request for this mess
    const existingRequest = await RequesteMessView.findOne({
        messId,
        userId,
        status: { $in: ["pending", "accepted"] },
    });

    if (existingRequest) {
        if (existingRequest.status === "pending") {
            throw new ApiError(
                400,
                "You have already sent a request for this mess. Please wait for owner's response."
            );
        } else if (existingRequest.status === "accepted") {
            throw new ApiError(
                400,
                "Your request for this mess has already been accepted."
            );
        }
    }

    // Check if user has a rejected request that can be resubmitted
    const rejectedRequest = await RequesteMessView.findOne({
        messId,
        userId,
        status: "rejected",
    });

    let savedRequest;

    if (rejectedRequest) {
        // Update the rejected request to pending instead of creating new one
        rejectedRequest.status = "pending";
        rejectedRequest.createdAt = new Date();
        savedRequest = await rejectedRequest.save();
    } else {
        // Create new request if no existing requests found
        const newRequest = new RequesteMessView({
            messId,
            userId,
            ownerId,
        });
        savedRequest = await newRequest.save();
    }

    // Send email notification to owner
    try {
        const owner = await User.findById(ownerId);
        if (owner && owner.email) {
            const requestData = {
                userName: user.name,
                userEmail: user.email,
                userPhone: user.phone,
                messTitle: mess.title,
                messAddress: mess.address,
                requestStatus: 'pending',
                requestDate: savedRequest.createdAt,
                requestId: savedRequest._id.toString(),
                messId: messId
            };

            await sendRequestStatusUpdateToOwner(owner.email, requestData);
            console.log('Viewing request notification sent to owner:', owner.email);
        }
    } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't throw error - email failure shouldn't break the request creation
    }

    const message = rejectedRequest 
        ? "Request resubmitted successfully! Owner will contact with you."
        : "Request Sent Successfully! Owner will contact with you.";

    return res.status(rejectedRequest ? 200 : 201).json(new ApiSuccess(message, rejectedRequest ? 200 : 201));
});

const updateRequestStatus = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const { status } = req.body;
    const ownerId = req.user.id;

    // Validate status
    const allowedStatuses = ["pending", "accepted", "rejected"];
    if (!allowedStatuses.includes(status)) {
        throw new ApiError(
            400,
            "Invalid status. Allowed statuses: pending, accepted, rejected"
        );
    }

    // Find the request and populate necessary fields
    const viewRequest = await RequesteMessView.findById(requestId)
        .populate("userId", "name email")
        .populate("ownerId", "name email")
        .populate("messId", "title address status");

    if (!viewRequest) {
        throw new ApiError(404, "Viewing request not found");
    }

    // Verify that the current user is the owner of the mess
    if (viewRequest.ownerId._id.toString() !== ownerId.toString()) {
        throw new ApiError(
            403,
            "You are not authorized to update this request"
        );
    }

    // Check if the request is already in the desired status
    if (viewRequest.status === status) {
        throw new ApiError(400, `Request is already ${status}`);
    }

    // Additional validation for status transitions
    if (status === "pending" && viewRequest.status !== "rejected") {
        throw new ApiError(400, "Can only resubmit rejected requests");
    }

    // ✅ Update mess status to "pending" if request is accepted
    if (status === "accepted") {
        const mess = await MessListing.findById(viewRequest.messId._id);
        if (mess) {
            mess.status = "pending";
            await mess.save();
            console.log(`✅ Mess status updated to "pending" for mess: ${mess.title}`);
        }
    }

    // Update the request status
    const previousStatus = viewRequest.status;
    viewRequest.status = status;
    viewRequest.updatedAt = new Date();

    // Add status history for tracking
    if (!viewRequest.statusHistory) {
        viewRequest.statusHistory = [];
    }

    viewRequest.statusHistory.push({
        status: status,
        changedBy: ownerId,
        changedAt: new Date(),
        previousStatus: previousStatus
    });

    await viewRequest.save();

    // ✅ CORRECT: Send email notification to user with proper parameters
    try {
        await sendStatusUpdateEmail(
            viewRequest.userId.email, // First parameter: userEmail
            {                         // Second parameter: requestData
                userName: viewRequest.userId.name,
                messTitle: viewRequest.messId.title, // Use messTitle instead of messName
                messAddress: viewRequest.messId.address,
                ownerName: viewRequest.ownerId.name,
                oldStatus: previousStatus,           // Use oldStatus instead of previousStatus
                newStatus: status,
                requestDate: viewRequest.createdAt,
                updateDate: new Date()
            }
        );
        console.log(`✅ Status update email sent to: ${viewRequest.userId.email}`);
    } catch (emailError) {
        console.error('❌ Failed to send status update email:', emailError);
        // Don't throw error, just log it
    }

    let message = "";
    switch (status) {
        case "accepted":
            message = "Request accepted successfully. User has been notified and mess status set to pending.";
            break;
        case "rejected":
            message = "Request rejected successfully. User has been notified.";
            break;
        case "pending":
            message = "Request status updated to pending.";
            break;
        default:
            message = "Request status updated successfully.";
    }

    return res.status(200).json(
        new ApiSuccess(message, {
            request: {
                id: viewRequest._id,
                status: viewRequest.status,
                userId: viewRequest.userId,
                messId: viewRequest.messId,
                updatedAt: viewRequest.updatedAt,
                messStatus: status === "accepted" ? "pending" : viewRequest.messId.status
            },
        }, 200)
    );
});

// Optional: Get request details for owner
const getRequestDetails = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const ownerId = req.user.id;

    const request = await RequesteMessView.findById(requestId)
        .populate("userId", "name email phone avatar")
        .populate("messId", "name location address images")
        .populate("ownerId", "name email phone");

    if (!request) {
        throw new ApiError(404, "Viewing request not found");
    }

    // Verify ownership
    if (request.ownerId._id.toString() !== ownerId.toString()) {
        throw new ApiError(403, "You are not authorized to view this request");
    }

    return res.status(200).json(
        new ApiSuccess(200, "Request details fetched successfully", {
            request: {
                id: request._id,
                status: request.status,
                user: request.userId,
                mess: request.messId,
                owner: request.ownerId,
                requestedDate: request.requestedDate,
                preferredTime: request.preferredTime,
                additionalNotes: request.additionalNotes,
                statusHistory: request.statusHistory,
                createdAt: request.createdAt,
                updatedAt: request.updatedAt,
            },
        })
    );
});

const getAllRequests = asyncHandler(async (req, res) => {
    const ownerId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    
    console.log('Owner ID:', ownerId);

    // Validate page and limit
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1) {
        throw new ApiError(400, "Page and limit must be positive numbers");
    }

    // Build filter object
    const filter = { ownerId: new mongoose.Types.ObjectId(ownerId) };

    // Execute query with pagination
    const skip = (pageNum - 1) * limitNum;

    const requests = await RequesteMessView.find(filter)
        .populate("userId", "name email phone avatar")
        .populate("ownerId", "name email phone")
        .populate("messId", "title location address images")
        .skip(skip)
        .limit(limitNum)
        .lean();

    // Get total count for pagination
    const totalRequests = await RequesteMessView.countDocuments(filter);

    // Get status counts for filters
    const statusCounts = await RequesteMessView.aggregate([
        { $match: { ownerId: new mongoose.Types.ObjectId(ownerId) } },
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
            },
        },
    ]);

    // Format status counts
    const statusStats = {
        all: totalRequests,
        pending: 0,
        accepted: 0,
        rejected: 0,
    };

    statusCounts.forEach((item) => {
        statusStats[item._id] = item.count;
    });

    // ✅ FIXED: Format response data with null checks
    const formattedRequests = requests.map((request) => {
        // Check if populated fields exist
        const user = request.userId ? {
            id: request.userId._id,
            name: request.userId.name || 'N/A',
            email: request.userId.email || 'N/A',
            phone: request.userId.phone || 'N/A',
            avatar: request.userId.avatar || null,
        } : {
            id: null,
            name: 'User Not Found',
            email: 'N/A',
            phone: 'N/A',
            avatar: null,
        };

        const owner = request.ownerId ? {
            id: request.ownerId._id,
            name: request.ownerId.name || 'N/A',
            email: request.ownerId.email || 'N/A',
            phone: request.ownerId.phone || 'N/A',
        } : {
            id: null,
            name: 'Owner Not Found',
            email: 'N/A',
            phone: 'N/A',
        };

        const mess = request.messId ? {
            id: request.messId._id,
            name: request.messId.title || 'N/A',
            location: request.messId.location || 'N/A',
            address: request.messId.address || 'N/A',
            images: request.messId.images || [],
        } : {
            id: null,
            name: 'Mess Not Found',
            location: 'N/A',
            address: 'N/A',
            images: [],
        };

        return {
            id: request._id,
            user,
            owner,
            mess,
            status: request.status,
            requestedDate: request.createdAt,
            preferredTime: request.preferredTime,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
        };
    });

    // Pagination info
    const totalPages = Math.ceil(totalRequests / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    return res.status(200).json(
        new ApiSuccess(
            "Requests fetched successfully",
            {
                requests: formattedRequests,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalRequests,
                    hasNextPage,
                    hasPrevPage,
                    limit: limitNum,
                },
                filters: {
                    status: statusStats,
                },
            },
            200
        )
    );
});

// Optional: Get requests for specific mess
const getRequestsByMess = asyncHandler(async (req, res) => {
    const ownerId = req.user.id;
    const { messId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    // Validate mess exists and belongs to owner
    const mess = await MessListing.findOne({ _id: messId, owner_id: ownerId });
    if (!mess) {
        throw new ApiError(404, "Mess not found or you don't have permission");
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1) {
        throw new ApiError(400, "Page and limit must be positive numbers");
    }

    // Build filter
    const filter = { ownerId, messId };

    if (status && status !== "all") {
        if (!["pending", "accepted", "rejected"].includes(status)) {
            throw new ApiError(400, "Invalid status");
        }
        filter.status = status;
    }

    const skip = (pageNum - 1) * limitNum;

    const requests = await RequesteMessView.find(filter)
        .populate("userId", "name email phone avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

    const totalRequests = await RequesteMessView.countDocuments(filter);

    // Format response
    const formattedRequests = requests.map((request) => ({
        id: request._id,
        user: {
            id: request.userId._id,
            name: request.userId.name,
            email: request.userId.email,
            phone: request.userId.phone,
            avatar: request.userId.avatar,
        },
        status: request.status,
        requestedDate: request.requestedDate,
        preferredTime: request.preferredTime,
        additionalNotes: request.additionalNotes,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
    }));

    const totalPages = Math.ceil(totalRequests / limitNum);

    return res.status(200).json(
        new ApiSuccess(200, "Mess requests fetched successfully", {
            mess: {
                id: mess._id,
                name: mess.name,
                location: mess.location,
            },
            requests: formattedRequests,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalRequests,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1,
                limit: limitNum,
            },
        })
    );
});

// Optional: Get user's own requests (for regular users)
const getMyRequests = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    console.log("User id in my requests:", userId);
    const { page = 1, limit = 10, status } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1) {
        throw new ApiError(400, "Page and limit must be positive numbers");
    }

    const filter = { userId };

    if (status && status !== "all") {
        if (!["pending", "accepted", "rejected"].includes(status)) {
            throw new ApiError(400, "Invalid status");
        }
        filter.status = status;
    }

    const skip = (pageNum - 1) * limitNum;

    const requests = await RequesteMessView.find(filter)
        .populate("messId", "title location address images price")
        .populate("ownerId", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

    const totalRequests = await RequesteMessView.countDocuments(filter);

    const formattedRequests = requests.map((request) => ({
        id: request._id,
        mess: {
            id: request.messId._id,
            name: request.messId.title,
            location: request.messId.location,
            address: request.messId.address,
            images: request.messId.images,
            price: request.messId.price,
        },
        owner: {
            id: request.ownerId._id,
            name: request.ownerId.name,
            email: request.ownerId.email,
            phone: request.ownerId.phone,
        },
        status: request.status,
        requestedDate: request.requestedDate,
        preferredTime: request.preferredTime,
        additionalNotes: request.additionalNotes,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
    }));

    const totalPages = Math.ceil(totalRequests / limitNum);

    return res.status(200).json(
        new ApiSuccess(
            "Your requests fetched successfully",
            {
                requests: formattedRequests,
                pagination: {
                    currentPage: pageNum,
                    totalPages,
                    totalRequests,
                    hasNextPage: pageNum < totalPages,
                    hasPrevPage: pageNum > 1,
                    limit: limitNum,
                },
            },
            200
        )
    );
});

export {
    addRequest,
    updateRequestStatus,
    getRequestDetails,
    getAllRequests,
    getRequestsByMess,
    getMyRequests,
};
