import mongoose, { Schema } from "mongoose";

const requestMessView = new mongoose.Schema(
    {
        messId: {
            type: Schema.Types.ObjectId,
            ref: "MessListing",
            require: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            require: true,
        },
        ownerId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            require: true,
        },
        status: {
            type: String,
            enum: ["pending", "accepted", "rejected"],
            default: "pending",
        },
    },
    { timestamps: true }
);

const RequesteMessView = mongoose.model("RequesteMessView", requestMessView)

export default RequesteMessView;
