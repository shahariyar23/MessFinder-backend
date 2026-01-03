import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "student", "owner"],
      default: "student",
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      index: true,
    },

    /* ---------------- PASSWORD RESET OTP ---------------- */
    resetPasswordCode: {
      type: Number,
    },
    resetPasswordExpires: {
      type: Date,
    },

    /* ---------------- LOGIN OTP (NEW) ---------------- */
    loginOtp: {
      type: String,
    },
    loginOtpExpires: {
      type: Date,
    },
    loginOtpAttempts: {
      type: Number,
      default: 0,
    },

    /* ---------------- SECURITY ---------------- */
    isActive: {
      type: Boolean,
      default: true,
    },

    accessToken: {
      type: String,
    },

    loginAttempts: {
      type: Number,
      default: 0,
    },

    lockUntil: {
      type: Date,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
