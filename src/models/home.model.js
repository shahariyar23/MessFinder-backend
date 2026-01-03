import mongoose from "mongoose";

const homeSchema = new mongoose.Schema({
    title: {
      type: String,
      required: true,
      trim: true,
      maxLength: 120,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxLength: 400,
    },

    buttonText: {
      type: String,
      required: true,
      trim: true,
      maxLength: 50,
    },

    buttonLink: {
      type: String,
      default: "/mess/listing",
    },

    backgroundImage: {
       url: {
                type: String,
                required: true
            },
            public_id: {
                type: String,
                required: true
            }
    }
}, { timestamps: true });

const HomePage = mongoose.model("HomePage", homeSchema)
export default HomePage;
