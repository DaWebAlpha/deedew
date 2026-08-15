import mongoose from "mongoose";
import { createSchema } from "../base/index.js";
import { SECURITY_CONFIG } from "../../constants/index.js";

const { ObjectId } = mongoose.Schema.Types;

/**
 * Access-control state for one User, kept in its own document so
 * constant writes (failed logins) never collide with profile edits.
 * Covers automatic lockout, admin bans, and admin suspensions.
 */
const userSecuritySchemaDefinition = {
    userId: {
        type: ObjectId,
        ref: "User",
        required: [true, "User id is required"],
        unique: true,
    },
    failedLoginAttempts: {
        type: Number,
        default: 0,
    },
    lastFailedLoginAt: {
        type: Date,
        default: null,
    },
    lockedUntil: {
        type: Date,
        default: null
    },
    lastLoginAt: {
        type: Date,
        default: null,
    },
    lastLoginIp: {
        type: String,
        default: null,
    },
    isBanned: {
        type: Boolean,
        default: false,
    },
    bannedAt: {
        type: Date,
        default: null,
    },
    bannedBy: {
        type: ObjectId,
        ref: "User",
        default: null,
    },
    banReason: {
        type: String,
        default: null,
    },
    unbannedAt: {
        type: Date,
        default: null,
    },
    unbannedBy: {
        type: ObjectId,
        ref: "User",
        default: null,
    },
    suspendedUntil: {
        type: Date,
        default: null,
    },
    suspendedBy: {
        type: ObjectId,
        ref: "User",
        default: null,
    },
    suspendReason: {
        type: String,
        default: null,
    },
    unsuspendedAt: {
        type: Date,
        default: null,
    },
    unsuspendedBy: {
        type: ObjectId,
        ref: "User",
        default: null,
    },
}

const userSecuritySchema = createSchema(userSecuritySchemaDefinition);


userSecuritySchema.methods.isLocked = function () {
    return Boolean(this.lockedUntil) && this.lockedUntil.getTime() > Date.now();
};

userSecuritySchema.methods.isSuspended = function () {
    return Boolean(this.suspendedUntil) && this.suspendedUntil.getTime() > Date.now();
};

userSecuritySchema.methods.registerFailedAttempt = function({session = null} = {}){
    this.failedLoginAttempts = (this.failedLoginAttempts || 0) + 1;
    this.lastFailedLoginAt = new Date();

    if(this.failedLoginAttempts >= SECURITY_CONFIG.MAX_FAILED_LOGIN_ATTEMPTS){
        this.lockedUntil = new Date(
            Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000
        );

    }

    return this.save({session, validateBeforeSave: false});
}


userSecuritySchema.methods.registerSuccessfulLogin = function({ipAddress = null, session = null} = {}){
    this.failedLoginAttempts = 0;
    this.lastLoginAt = new Date();
    this.lockedUntil = null;
    this.lastLoginIp = ipAddress;

    return this.save({session, validateBeforeSave: false});
}

userSecuritySchema.methods.ban = function ({ bannedByUserId = null, reason = null, session = null } = {}) {
    this.isBanned = true;
    this.bannedAt = new Date();
    this.bannedBy = bannedByUserId;
    this.banReason = reason;
    this.unbannedAt = null;
    this.unbannedBy = null;

    return this.save({ session, validateBeforeSave: false });
};

userSecuritySchema.methods.unban = function ({ unbannedByUserId = null, reason = null, session = null } = {}) {
    this.isBanned = false;
    this.bannedAt = null;
    this.bannedBy = null;
    this.banReason = null;
    this.unbannedAt = new Date();
    this.unbannedBy = unbannedByUserId;

    return this.save({ session, validateBeforeSave: false });
};

userSecuritySchema.methods.suspend = function ({ suspendedByUserId = null, reason = null, until, session = null } = {}) {
    this.suspendedUntil = until;
    this.suspendedBy = suspendedByUserId;
    this.suspendReason = reason;
    this.unsuspendedAt = null;
    this.unsuspendedBy = null;

    return this.save({ session, validateBeforeSave: false });
};

userSecuritySchema.methods.unsuspend = function ({ unsuspendedByUserId = null, reason = null, session = null } = {}) {
    this.suspendedUntil = null;
    this.suspendedBy = null;
    this.suspendReason = null;
    this.unsuspendedAt = new Date();
    this.unsuspendedBy = unsuspendedByUserId;

    return this.save({ session, validateBeforeSave: false });
};


userSecuritySchema.statics.findOrCreateForUser = async function (userId, { session = null } = {}) {
    let query = this.findOne({ userId });

    if (session) {
        query = query.session(session);
    }

    const existing = await query;

    if (existing) {
        return existing;
    }

    const [created] = await this.create(
        [{ userId }],
        session ? { session } : undefined,
    );

    return created;
};

const UserSecurity = mongoose.model("UserSecurity", userSecuritySchema);

export { UserSecurity };
