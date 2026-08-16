import mongoose from "mongoose";
import { createSchema } from "../base/index.js";
import { normalizePhoneNumber } from "../../utils/index.js";

const { ObjectId } = mongoose.Schema.Types;

/** A saved delivery address belonging to a User. */
const addressSchemaDefinition = {
    userId: {
        type: ObjectId,
        ref: "User",
        required: [true, "User id is required"],
    },
    label: {
        type: String,
        trim: true,
        default: null,
        maxlength: [50, "Label is too long"],
    },
     recipientName: {
        type: String,
        trim: true,
        required: [true, "Recipient name is required"],
        maxlength: [100, "Recipient name is too long"],
    },
    recipientPhone: {
        type: String,
        trim: true,
        required: [true, "Recipient phone number is required"],
        validate: {
            validator: (value) => normalizePhoneNumber(value, "GH") !== null,
            message: "Enter a valid phone number",
        },
    },
    region: { type: String, trim: true, default: null },
    city: { type: String, trim: true, default: null },
    street: { type: String, trim: true, default: null },
    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point",
        },
        coordinates: {
            type: [Number],
            required: [true, "Location coordinates are required"],
        },
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
}

const addressSchema = createSchema(addressSchemaDefinition);
addressSchema.index({ userId: 1 });
addressSchema.index({ location: "2dsphere" });
const Address = mongoose.model("Address", addressSchema);

export {
    Address
}
