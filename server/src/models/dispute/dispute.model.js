import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

const DISPUTE_REASON = ["item_not_received", "item_damaged", "item_not_as_described", "wrong_item", "other"];
const DISPUTE_STATUS = ["open", "under_review", "resolved", "rejected"];

/**
 * A buyer-raised complaint against an Order, escalated for admin
 * resolution. Not from the reference project — an original addition.
 */
const disputeSchemaDefinition = {
    orderId: {
        type: ObjectId,
        ref: "Order",
        required: [true, "Order id is required"],
    },
    raisedBy: {
        type: ObjectId,
        ref: "User",
        required: [true, "Raised-by user id is required"],
    },
    againstSellerId: {
        type: ObjectId,
        ref: "SellerProfile",
        required: [true, "Seller id is required"],
    },
    reason: {
        type: String,
        enum: DISPUTE_REASON,
        required: [true, "Reason is required"],
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, "Description is too long"],
        default: null,
    },
    evidence: {
        type: [String],
        default: [],
    },
    status: {
        type: String,
        enum: DISPUTE_STATUS,
        default: "open",
    },
    resolution: {
        type: String,
        trim: true,
        default: null,
    },
    resolvedBy: {
        type: ObjectId,
        ref: "User",
        default: null,
    },
    resolvedAt: {
        type: Date,
        default: null,
    },
};

const disputeSchema = createSchema(disputeSchemaDefinition);

disputeSchema.index({ orderId: 1 });
disputeSchema.index({ againstSellerId: 1 });
disputeSchema.index({ status: 1 });

const Dispute = mongoose.model("Dispute", disputeSchema);
export { Dispute };
