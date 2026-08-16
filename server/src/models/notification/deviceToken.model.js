import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

const DEVICE_PLATFORM = ["ios", "android", "web"];

/**
 * A push-notification token for one of a User's devices — Notification
 * covers in-app state (read/unread); this is what actually lets the
 * server deliver a push. Not from the reference project — an original
 * addition.
 */
const deviceTokenSchemaDefinition = {
    userId: {
        type: ObjectId,
        ref: "User",
        required: [true, "User id is required"],
    },
    token: {
        type: String,
        trim: true,
        required: [true, "Token is required"],
        unique: true,
    },
    platform: {
        type: String,
        enum: DEVICE_PLATFORM,
        required: [true, "Platform is required"],
    },
    deviceId: {
        type: String,
        trim: true,
        default: null,
    },
    lastUsedAt: {
        type: Date,
        default: null,
    },
};

const deviceTokenSchema = createSchema(deviceTokenSchemaDefinition);

deviceTokenSchema.index({ userId: 1 });
deviceTokenSchema.index({ token: 1 });

const DeviceToken = mongoose.model("DeviceToken", deviceTokenSchema);
export { DeviceToken };
