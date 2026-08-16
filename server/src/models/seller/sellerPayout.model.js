import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

const PAYOUT_STATUS = ["pending", "processing", "paid", "failed"];
const PAYOUT_METHOD = ["mobile_money", "bank_transfer"];

/**
 * One payout batch to a seller, covering a date range of settled
 * orders. orderIds lets support/finance trace exactly which orders a
 * payout covered. Not from the reference project — SellerProfile
 * stored payout details but nothing recorded actual payouts made.
 */
const sellerPayoutSchemaDefinition = {
    sellerId: {
        type: ObjectId,
        ref: "SellerProfile",
        required: [true, "Seller id is required"],
    },
    /** Minor units — total paid out for this batch. */
    amount: {
        type: Number,
        required: [true, "Amount is required"],
        min: [0, "Amount cannot be negative"],
        validate: { validator: Number.isInteger, message: "Amount must be an integer number of minor units" },
    },
    periodStart: {
        type: Date,
        required: [true, "Period start is required"],
    },
    periodEnd: {
        type: Date,
        required: [true, "Period end is required"],
    },
    orderIds: {
        type: [{ type: ObjectId, ref: "Order" }],
        default: [],
    },
    payoutMethod: {
        type: String,
        enum: PAYOUT_METHOD,
        required: [true, "Payout method is required"],
    },
    status: {
        type: String,
        enum: PAYOUT_STATUS,
        default: "pending",
    },
    providerReference: {
        type: String,
        trim: true,
        default: null,
    },
    paidAt: {
        type: Date,
        default: null,
    },
    failureReason: {
        type: String,
        trim: true,
        default: null,
    },
};

const sellerPayoutSchema = createSchema(sellerPayoutSchemaDefinition);

sellerPayoutSchema.index({ sellerId: 1 });
sellerPayoutSchema.index({ status: 1 });

sellerPayoutSchema.virtual("amountMajor").get(function () {
    return this.amount / 100;
});

const SellerPayout = mongoose.model("SellerPayout", sellerPayoutSchema);
export { SellerPayout };
