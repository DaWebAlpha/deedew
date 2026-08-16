import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

/**
 * A message thread between exactly two users, optionally scoped to a
 * Product (pre-purchase inquiry) or Order (post-purchase discussion).
 * Message documents point back here via conversationId; this document
 * only tracks participants and a denormalized preview of the latest
 * message, so listing a user's conversations never has to scan the
 * Message collection. Not from the reference project — an original
 * addition for buyer/seller communication.
 */
const conversationSchemaDefinition = {
    participants: {
        type: [{
            type: ObjectId,
            ref: "User",
        }],
        validate: {
            validator: (value) => Array.isArray(value) && value.length === 2,
            message: "A conversation must have exactly two participants",
        },
    },
    productId: {
        type: ObjectId,
        ref: "Product",
        default: null,
    },
    orderId: {
        type: ObjectId,
        ref: "Order",
        default: null,
    },
    lastMessageAt: {
        type: Date,
        default: null,
    },
    lastMessagePreview: {
        type: String,
        trim: true,
        maxlength: [200, "Message preview is too long"],
        default: null,
    },
};

const conversationSchema = createSchema(conversationSchemaDefinition);

conversationSchema.index({ participants: 1 });
conversationSchema.index({ orderId: 1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export { Conversation };
