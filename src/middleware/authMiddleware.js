import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"

export const authMiddleware = asyncHandler(async (req, res, next) => {
    try {
        // Get token from multiple sources
        const token = req.cookies?.token || 
                     req.headers.authorization?.replace('Bearer ', '');
        
        console.log(req.cookies.token, "auth midlleware");

        if (!token) {
            throw new ApiError(401, "No token provided");
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Auth Middleware - Token decoded for user:', decoded.id);
        
        req.user = decoded;
        next();
    } catch (error) {
        console.log('Auth Middleware Error:', error.message);
        
        if (error.name === 'JsonWebTokenError') {
            throw new ApiError(401, "Invalid token");
        } else if (error.name === 'TokenExpiredError') {
            throw new ApiError(401, "Token expired");
        }
        
        throw new ApiError(401, "Authentication failed");
    }
});