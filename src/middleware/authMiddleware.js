import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"

export const authMiddleware = asyncHandler(async (req, res, next)=>{
    const token = req.cookies.token;
    if(!token){
        throw new ApiError(400, "Unautoraize user")
    }
    const decode = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decode;
    next();
})