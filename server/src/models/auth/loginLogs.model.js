import mongoose from "mongoose";
import { mongooseSchemaOptions } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

/**
 * One document per login attempt, success or failure — a security
 * audit trail. Deliberately NOT built through createSchema(): no
 * isDeleted/softDelete, since an audit log must stay immutable to be
 * trustworthy. Only reuses mongooseSchemaOptions for JSON cleanup.
 */
const loginLogSchemaDefinition = {
    userId: {
        type: ObjectId,
        ref: "User",
        default: null,
    },
    identifier: {
        type: String,
        required: [true, "Identifier is required"],
    },
    success: {
        type: Boolean,
        required: true,
    },
    reason: {
        type: String,
        default: null,
    },
    ipAddress: {
        type: String,
        default: null,
    },
    userAgent: {
        type: String,
        default: null,
    },
    deviceName: {
        type: String,
        default: null,
    },
    deviceId: {
        type: String,
        default: null,
    },
};

const loginLogSchema = new mongoose.Schema(loginLogSchemaDefinition, {
    ...mongooseSchemaOptions,
    timestamps: { createdAt: true, updatedAt: false },
});

loginLogSchema.index({ userId: 1, createdAt: -1 });
loginLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

const LoginLog = mongoose.model("LoginLog", loginLogSchema);

export { LoginLog };
