import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import ApiSuccess from "../utils/ApiSuccess.js";



const register = asyncHandler(async (req, res) => {
    const { name, email, password, phone, role } = req.body;
    
    // Just throw errors - the middleware will handle them
    if (!name || !email || !password || !phone || !role) {
        throw new ApiError(400, "All fields are required");
    }
    
    if (role === "admin") {
        throw new ApiError(400, "Cannot register as admin");
    }
    
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
        throw new ApiError(400, "User with this email or phone already exists");
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = new User({ name, email, password: hashedPassword, phone, role });
    await newUser.save();
    
    // Remove password from response
    const userResponse = { ...newUser.toObject() };
    delete userResponse.password;
    
     return res.status(201).json(
        new ApiSuccess("User registered successfully", userResponse, 201)
    );
});


const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(400, "Invalid email or password"); // Don't specify which one for security
    }

    // Check if account is deactivated FIRST
    if (!user.isActive) {
        throw new ApiError(403, "Your account is deactivated due to multiple failed login attempts. Please contact support.");
    }

    // Check if account is temporarily locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
        const minutes = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
        throw new ApiError(403, `Account temporarily locked due to multiple failed login attempts. Please try again in ${minutes} minute(s).`);
    }

    // Password verification
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
        // Increment failed attempts
        user.loginAttempts += 1;

        // Lock account after 3 failed attempts
        if (user.loginAttempts >= 3) {
            user.lockUntil = Date.now() + 2 * 60 * 1000; // 2 minutes lock
        }

        // Deactivate account after 5 failed attempts
        if (user.loginAttempts >= 5) {
            user.isActive = false;
        }

        await user.save();
        
        throw new ApiError(400, "Invalid email or password");
    }

    // SUCCESSFUL LOGIN: Reset attempts and lock
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();

    // Generate JWT token
    const token = jwt.sign(
        { 
            id: user._id, 
            email: user.email, 
            name: user.name, 
            role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
    );

    user.accessToken = token;
    await user.save();

    // Remove password from user object
    const userWithoutPassword = { ...user.toObject() };
    delete userWithoutPassword.password;

    // Return response
    return res
    .status(200)
    .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
    })
    .json(new ApiSuccess("Login successful", { 
        token, 
        user: userWithoutPassword 
    }, 200));
});


const logout = asyncHandler((req, res)=>{
    res.clearCookie("token").json(new ApiSuccess("logout successful", 200))
})

// controllers/authController.js
const generateResetCode = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({ email });
    if (!user) {
        // Don't reveal if email exists for security
        return res.json(new ApiSuccess("If the email exists, a reset code has been sent"));
    }

    // Generate 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000);
    
    // Set expiration (10 minutes from now)
    const resetCodeExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.resetPasswordCode = resetCode;
    user.resetPasswordExpires = resetCodeExpiry;
    await user.save();

    // TODO: Send email with reset code
    console.log(`Reset code for ${email}: ${resetCode}`); // Remove in production

    return res.json(new ApiSuccess("Reset code sent to your email"));
});

const verifyResetCode = asyncHandler(async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        throw new ApiError(400, "Email and reset code are required");
    }

    const user = await User.findOne({ 
        email, 
        resetPasswordCode: code,
        resetPasswordExpires: { $gt: new Date() } // Check if not expired
    });

    if (!user) {
        throw new ApiError(400, "Invalid or expired reset code");
    }

    // Code is valid - you might want to create a temporary token for password reset
    const resetToken = jwt.sign(
        { 
            id: user._id, 
            purpose: 'password_reset' 
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' } // Short-lived token
    );

    return res.json(new ApiSuccess("Reset code verified", { resetToken }));
});


const resetPassword = asyncHandler(async (req, res) => {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
        throw new ApiError(400, "Reset token and new password are required");
    }

    try {
        // Verify the reset token
        const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
        
        if (decoded.purpose !== 'password_reset') {
            throw new ApiError(400, "Invalid reset token");
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            throw new ApiError(400, "User not found");
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password and clear reset fields
        user.password = hashedPassword;
        user.resetPasswordCode = undefined;
        user.resetPasswordExpires = undefined;
        user.loginAttempts = 0; // Reset login attempts
        user.lockUntil = undefined;
        user.isActive = true;
        
        await user.save();

        return res.json(new ApiSuccess("Password reset successfully"));

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            throw new ApiError(400, "Invalid or expired reset token");
        }
        if (error.name === 'TokenExpiredError') {
            throw new ApiError(400, "Reset token has expired");
        }
        throw error;
    }
});


const getAllStudents = asyncHandler(async (req, res) => {
     if (req.user.role !== "admin") {
        throw new ApiError(403, "Only admin can see all students");
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const students = await User.find({ role: 'student' })
        .select('-password')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalPages = Math.ceil(totalStudents / limit);

    return res.status(200).json(
        new ApiSuccess("Students retrieved successfully", {
            students,
            pagination: {
                currentPage: page,
                totalPages,
                totalStudents,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        })
    );
});


const getAllOwners = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Only admin can see all students");
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const students = await User.find({ role: 'owner' })
        .select('-password')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

    const totalOwners = await User.countDocuments({ role: 'owner' });
    const totalPages = Math.ceil(totalOwners / limit);

    return res.status(200).json(
        new ApiSuccess("Owners retrieved successfully", {
            students,
            pagination: {
                currentPage: page,
                totalPages,
                totalOwners,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        })
    );
});


export { register, login, logout, generateResetCode, verifyResetCode, resetPassword, getAllOwners, getAllStudents };