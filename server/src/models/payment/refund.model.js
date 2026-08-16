import mongoose from "mongoose";
import { createSchema, transformDocument } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

const REFUND_STATUS = ["pending", "processing", "successful", "failed"];

/**
 * One refund transaction against a Payment — kept separate from a
 * single "refunded" status on Payment so partial and/or multiple
 * refunds against one payment are representable. Not from the
 * reference project — an original addition.
 */
const refundSchemaDefinition = {
    paymentId: {
        type: ObjectId,
        ref: "Payment",
        required: [true, "Payment id is required"],
    },
    orderId: {
        type: ObjectId,
        ref: "Order",
        required: [true, "Order id is required"],
    },
    /** Minor units — should never exceed the originating payment's amount; enforced in the service layer. */
    amount: {
        type: Number,
        required: [true, "Amount is required"],
        min: [0, "Amount cannot be negative"],
        validate: { validator: Number.isInteger, message: "Amount must be an integer number of minor units" },
    },
    reason: {
        type: String,
        trim: true,
        default: null,
    },
    status: {
        type: String,
        enum: REFUND_STATUS,
        default: "pending",
    },
    /** Admin/system actor who triggered this refund, if not an automated flow. */
    initiatedBy: {
        type: ObjectId,
        ref: "User",
        default: null,
    },
    providerReference: {
        type: String,
        trim: true,
        default: null,
    },
    processedAt: {
        type: Date,
        default: null,
    },
    /** Raw gateway response, kept for reconciliation. Never exposed over the API. */
    gatewayResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
};

const refundSchema = createSchema(refundSchemaDefinition);

refundSchema.index({ paymentId: 1 });
refundSchema.index({ orderId: 1 });
refundSchema.index({ status: 1 });

refundSchema.virtual("amountMajor").get(function () {
    return this.amount / 100;
});

refundSchema.set("toJSON", {
    virtuals: true,
    transform: (document, returnedObject) => {
        const transformed = transformDocument(document, returnedObject);
        delete transformed.gatewayResponse;
        return transformed;
    },
});

const Refund = mongoose.model("Refund", refundSchema);
export { Refund };
