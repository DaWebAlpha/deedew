import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

/** One document per login session. Only the SHA-256 hash of the raw token is ever stored. */
const refreshTokenDefinition = {
    userId : {
        type: ObjectId,
        ref: "User",
        required: [true, "User id is required"],
    },
    tokenHash: {
        type: String,
        required: [true, "Token hash is required"],
        unique: true,
    },
    expiresAt: {
        type: Date,
        required: [true, "Expiry is required"],

    },
    revokedAt: {
        type: Date,
        default: null
    },
    userAgent: {
        type: String,
        default: null,
    },
    ipAddress: {
        type: String,
        default: null,
    },
    deviceName: {
        type: String,
        default: null
    },
    deviceId: {
        type: String,
        default: null
    }
}

const refreshTokenSchema = createSchema(refreshTokenDefinition);


// TTL index — MongoDB itself deletes a token once expiresAt passes.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

refreshTokenSchema.methods.isActive = function () {
    return !this.revokedAt && this.expiresAt.getTime() > Date.now();
};

refreshTokenSchema.methods.revoke = function ({ session = null } = {}) {
    this.revokedAt = new Date();
    return this.save({ session, validateBeforeSave: false });
};

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);

export { RefreshToken }