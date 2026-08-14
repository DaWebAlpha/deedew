import mongoose from "mongoose";

/** Minimal document used to verify the MongoDB connection end-to-end. */
const pingSchema = new mongoose.Schema({
    message: {
        type: String,
        trim: true,
        required: [true, "Message is required"],
        maxlength: [5000, "Message is too long"]

    }
}, {timestamps: true});

const Ping = mongoose.model("Ping", pingSchema);

export {
    Ping,
}
