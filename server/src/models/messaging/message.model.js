import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

const MESSAGE_BODY_MAX_LENGTH = 2000;

/**
 * One chat message inside a Conversation. Not from the reference
 * project — an original addition for buyer/seller communication.
 */
const messageSchemaDefinition = {
    conversationId: {
        type: ObjectId,
        ref: "Conversation",
        required: [true, "Conversation id is required"],
    },
    senderId: {
        type: ObjectId,
        ref: "User",
        required: [true, "Sender id is required"],
    },
    body: {
        type: String,
        trim: true,
        required: [true, "Message body is required"],
        maxlength: [MESSAGE_BODY_MAX_LENGTH, "Message is too long"],
    },
    attachments: {
        type: [String],
        default: [],
    },
    readAt: {
        type: Date,
        default: null,
    },
};

const messageSchema = createSchema(messageSchemaDefinition);

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1 });

const Message = mongoose.model("Message", messageSchema);

export { Message };
