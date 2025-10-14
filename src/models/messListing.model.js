import mongoose from "mongoose";

const messListing = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            index: true,
        },
        description: {
            type: String,
            required: true, 
            minLength: [6, "Too few words"], 
        },
        owner_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        address: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ["booked", "in progress", "free"],
            default: "free",
            required: true,
        },
        availableFrom: {
          
            type: Date,
            required: true,
            index: true,
        },
        advancePaymentMonth: {
            type: Number,
            enum: [0, 1, 2, 3],
            default: 1,
            required: true,
        },
        payPerMonth: {
            type: Number,
            required: true,
        },
        facilities: [
            {
                type: String,
                enum: [
                    "wifi",
                    "ac",
                    "lift",
                    "laundry",
                    "freezer",
                    "waterfilter",
                    "cctv",
                    "power_backup",
                    "meals",
                ],
                require: true
            },
        ],
        roomType:{
            type: String,
            enum:["single","shared"],
            require: true
        },
        roomFeatures:{
            type: String,
            enum:["master","balcony", "non-balcony"],
            require: true
        },
        genderPreference:{
            type: String,
            enum: ["male","female"],
            require: true
        },
        contact:{
            type: String,
            require: true
        },
        image:[{
            type: String,
            require: true
        }],
        view:{
            type: Number,
            default: 0
        },
        review:{
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);
messListingSchema.pre('validate', function(next) {
    if (this.images.length < 3) {
        this.invalidate('images', 'At least 3 images are required');
    }
    next();
});

const MessListing = mongoose.model("MessListing", messListing);

export default MessListing;
