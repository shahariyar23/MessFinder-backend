import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, index:true },
        email: { type: String, required: true, unique: true, index:true },
        password: { type: String, required: true },
        role: {
            type: String,
            enum: ["admin", "student", "owner"],
            default: "student",
        },
        phone:{
            type: String,
            required: [ true, "Phone number is required" ],
            unique: true,
            index:true
        },
        resetPasswordCode: {
            type: Number
        },
        resetPasswordExpires:{
            type: Date
        },
        isActive: { type: Boolean, default: true },
        accessToken: { type: String },
        loginAttempts: { type: Number, default: 0 },
        lockUntil: Date,


    },
    { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
