import asyncHandler from "../utils/asyncHandler.js";
import User from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import ApiSuccess from "../utils/ApiSuccess.js";
import {
    sendAccountDeactivatedNotification,
    sendLoginOtpEmail,
    sendPasswordResetCode,
    sendPasswordResetSuccess,
    sendWelcomeEmail,
} from "../utils/service/emailService.js";
import { getAccountLockedTemplate } from "../utils/emailTemplates.js";

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
    const newUser = new User({
        name,
        email,
        password: hashedPassword,
        phone,
        role,
    });
    await newUser.save();

    await sendWelcomeEmail(newUser.email, newUser.name);

    // Remove password from response
    const userResponse = { ...newUser.toObject() };
    delete userResponse.password;

    return res
        .status(201)
        .json(
            new ApiSuccess("User registered successfully", userResponse, 201)
        );
});

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    //  Validate input
    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    //  Find user
    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(400, "Invalid email or password");
    }

    //  Account status checks
    if (!user.isActive) {
        throw new ApiError(
            403,
            "Your account is deactivated. Please contact support."
        );
    }

    if (user.lockUntil && user.lockUntil > Date.now()) {
        const minutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
        throw new ApiError(
            403,
            `Account locked. Try again in ${minutes} minute(s).`
        );
    }

    //  Password validation
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
        user.loginAttempts += 1;

        if (user.loginAttempts >= 2) {
            user.lockUntil = Date.now() + 2 * 60 * 1000;
        }

        if (user.loginAttempts >= 5) {
            user.isActive = false;
            await sendAccountDeactivatedNotification(user.email, {
                name: user.name || "User",
                deactivationReason: "Multiple failed login attempts",
                loginAttempts: user.loginAttempts,
                contactEmail: "support@messfinder.com",
            });
        }

        await user.save();
        throw new ApiError(400, "Invalid email or password");
    }

    // ✅  Password is correct → reset counters
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();

    //  Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.loginOtp = otp;
    user.loginOtpExpires = Date.now() + 10 * 60 * 1000; // ⏳ 10 minutes
    user.loginOtpAttempts = 0;

    await user.save();

    // 7 Send OTP email
    try {
        await sendLoginOtpEmail(user.email, {
            name: user.name || "User",
            otp,
            expiresIn: "10 minutes",
        });
    } catch (err) {
        console.error("OTP email error:", err);
        throw new ApiError(500, "Failed to send OTP email");
    }

    // Respond → OTP required
    return res.status(200).json(
        new ApiSuccess(
            "OTP sent to your email",
            {
                otpRequired: true,
                email: user.email,
            },
            200
        )
    );
});

const verifyLoginOtp = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    const user = await User.findOne({ email });
    if (!user || !user.loginOtp) {
        throw new ApiError(400, "Invalid request");
    }

    if (user.loginOtpExpires < Date.now()) {
        throw new ApiError(400, "OTP expired");
    }

    if (user.loginOtp !== otp) {
        user.loginOtpAttempts += 1;
        await user.save();
        throw new ApiError(400, "Invalid OTP");
    }

    // ✅ OTP verified → clear OTP fields
    user.loginOtp = undefined;
    user.loginOtpExpires = undefined;
    user.loginOtpAttempts = 0;

    // ✅ Generate JWT
    const payload = {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE,
    });

    user.accessToken = token;
    await user.save();

    // 🍪 Cookie
    const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: "None",
        maxAge: 24 * 60 * 60 * 1000,
    };

    return res
        .status(200)
        .cookie("token", token, cookieOptions)
        .json(
            new ApiSuccess(
                "Login successful",
                {
                    user: {
                        id: user._id,
                        name: user.name,
                        phone: user.phone,
                        role: user.role,
                    },
                },
                200
            )
        );
});

const logout = asyncHandler(async (req, res) => {
  // Remove token from DB (optional but good)
  if (req.user?.id) {
    await User.findByIdAndUpdate(req.user.id, {
      $unset: { accessToken: "" },
    });
  }

  // ❗ MUST MATCH LOGIN COOKIE OPTIONS
  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/", // VERY IMPORTANT
  });

  return res.status(200).json(
    new ApiSuccess("Logged out successfully", null, 200)
  );
});


const generateResetCode = asyncHandler(async (req, res) => {
    let { email } = req.body;

    //console.log('Received email:', email);
    //console.log('Type of email:', typeof email);

    // Extract email from nested object if needed
    if (email && typeof email === "object" && email.email) {
        //console.log('Extracting email from nested object...');
        email = email.email;
    }

    // Final validation
    if (!email || typeof email !== "string") {
        throw new ApiError(400, "Valid email address is required");
    }

    // Clean the email
    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
        // Don't reveal if email exists for security
        return res.json(
            new ApiSuccess("If the email exists, a reset code has been sent")
        );
    }

    // Generate 6-digit code
    const resetCode = Math.floor(100000 + Math.random() * 900000);
    const resetCodeExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.resetPasswordCode = resetCode;
    user.resetPasswordExpires = resetCodeExpiry;
    await user.save();

    try {
        await sendPasswordResetCode(email, {
            name: user.name || user.username || "User",
            verificationCode: resetCode,
            expiryTime: "10 minutes",
        });

        //console.log(`Reset code sent to ${email}: ${resetCode}`);

        return res.json(
            new ApiSuccess("Password reset code has been sent to your email")
        );
    } catch (emailError) {
        console.error("Failed to send reset code email:", emailError);

        // Clear the reset code if email fails
        user.resetPasswordCode = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        throw new ApiError(500, "Failed to send reset code. Please try again.");
    }
});
const verifyResetCode = asyncHandler(async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        throw new ApiError(400, "Email and reset code are required");
    }

    const user = await User.findOne({
        email,
        resetPasswordCode: code,
        resetPasswordExpires: { $gt: new Date() }, // Check if not expired
    });

    if (!user) {
        throw new ApiError(400, "Invalid or expired reset code");
    }

    // Code is valid - you might want to create a temporary token for password reset
    const resetToken = jwt.sign(
        {
            id: user._id,
            purpose: "password_reset",
        },
        process.env.JWT_SECRET,
        { expiresIn: "15m" } // Short-lived token
    );

    return res.json(new ApiSuccess("Reset code verified", { resetToken }));
});

const resetPassword = asyncHandler(async (req, res) => {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
        throw new ApiError(
            400,
            "Email, reset code and new password are required"
        );
    }

    if (newPassword.length < 6) {
        throw new ApiError(400, "Password must be at least 6 characters long");
    }

    const user = await User.findOne({
        email,
        resetPasswordCode: code,
        resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
        throw new ApiError(400, "Invalid or expired reset code");
    }
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    // Update password
    user.password = hashedPassword;
    user.isActive = true;
    user.loginAttempts = 0;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send password reset success email
    try {
        await sendPasswordResetSuccess(email, {
            name: user.name || user.username || "User",
        });
    } catch (emailError) {
        console.error("Failed to send reset success email:", emailError);
        // Don't throw error, just log it
    }

    return res.json(new ApiSuccess("Password reset successfully"));
});

const getAllStudents = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin") {
        throw new ApiError(403, "Only admin can see all students");
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const students = await User.find({ role: "student" })
        .select("-password")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

    const totalStudents = await User.countDocuments({ role: "student" });
    const totalPages = Math.ceil(totalStudents / limit);

    return res.status(200).json(
        new ApiSuccess("Students retrieved successfully", {
            students,
            pagination: {
                currentPage: page,
                totalPages,
                totalStudents,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
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

    const students = await User.find({ role: "owner" })
        .select("-password")
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

    const totalOwners = await User.countDocuments({ role: "owner" });
    const totalPages = Math.ceil(totalOwners / limit);

    return res.status(200).json(
        new ApiSuccess("Owners retrieved successfully", {
            students,
            pagination: {
                currentPage: page,
                totalPages,
                totalOwners,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        })
    );
});

const getStudentById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        throw new ApiError(403, "user id is require ");
    }
    if (id !== req.user.id) {
        throw new ApiError(403, "only user can view his/ her own profile");
    }
    const user = await User.findById(id);
    
    if (!user) {
        throw new ApiError(403, "user is not found");
    }
    const newUser = {
        name: user.name,
        role: user.role,
        phone: user.phone,
        email: user.email,
    };
    
    return res.status(200).json(new ApiSuccess("user found", newUser));
});

export {
    register,
    login,
    verifyLoginOtp,
    logout,
    generateResetCode,
    verifyResetCode,
    resetPassword,
    getAllOwners,
    getAllStudents,
    getStudentById,
};
