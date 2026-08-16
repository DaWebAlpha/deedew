import mongoose from "mongoose";
import { mongooseSchemaOptions } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

/**
 * A persisted, queryable record of every admin action (ban, role
 * change, category edit, etc.) — the pino auditLogger writes to log
 * files, not a searchable collection, so this exists for compliance
 * and in-app audit views. Immutable like LoginLog: built directly on
 * mongoose.Schema, no soft-delete. Not from the reference project —
 * an original addition.
 */
const adminActionLogSchemaDefinition = {
    actorId: {
        type: ObjectId,
        ref: "User",
        required: [true, "Actor id is required"],
    },
    /** e.g. "USER_BANNED", "CATEGORY_UPDATED" — matches the pino auditLogger's log messages. */
    action: {
        type: String,
        trim: true,
        required: [true, "Action is required"],
    },
    targetType: {
        type: String,
        trim: true,
        default: null,
    },
    targetId: {
        type: ObjectId,
        default: null,
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    ipAddress: {
        type: String,
        default: null,
    },
};

const adminActionLogSchema = new mongoose.Schema(adminActionLogSchemaDefinition, {
    ...mongooseSchemaOptions,
    timestamps: { createdAt: true, updatedAt: false },
});

adminActionLogSchema.index({ actorId: 1, createdAt: -1 });
adminActionLogSchema.index({ targetType: 1, targetId: 1 });

const AdminActionLog = mongoose.model("AdminActionLog", adminActionLogSchema);
export { AdminActionLog };
