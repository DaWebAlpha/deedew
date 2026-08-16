import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

const NOTIFICATION_TYPE = [
    "order_status_changed",
    "new_message",
    "payment_received",
    "payment_failed",
    "account_banned",
    "account_suspended",
    "seller_verified",
    "seller_rejected",
];

/**
 * An in-app notification for one user. `data` carries whatever ids the
 * client needs to deep-link (e.g. { orderId } for
 * order_status_changed), kept as Mixed since the shape legitimately
 * differs per `type`. Not from the reference project — an original
 * addition.
 */
const notificationSchemaDefinition = {
    userId: {
        type: ObjectId,
        ref: "User",
        required: [true, "User id is required"],
    },
    type: {
        type: String,
        enum: NOTIFICATION_TYPE,
        required: [true, "Notification type is required"],
    },
    title: {
        type: String,
        trim: true,
        required: [true, "Title is required"],
        maxlength: [150, "Title is too long"],
    },
    body: {
        type: String,
        trim: true,
        maxlength: [500, "Body is too long"],
        default: null,
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    readAt: {
        type: Date,
        default: null,
    },
};

const notificationSchema = createSchema(notificationSchemaDefinition);

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

export { Notification };
