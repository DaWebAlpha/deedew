import mongoose from "mongoose";
import { createSchema } from "./base/index.js";


/**
 * Minimal document used to verify the MongoDB connection end-to-end.
 */
const pingSchemaDefinition = {
    message: {
        type: String,
        trim: true,
        required: [true, "Message is required"],
        maxlength: [5000, "Message is too long"]

    }
};

const pingSchema = createSchema(pingSchemaDefinition);

const Ping = mongoose.model("Ping", pingSchema);

export {
    Ping,
}
