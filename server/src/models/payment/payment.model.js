import mongoose from "mongoose";
import { createSchema, transformDocument } from "../base/index.js";
import { CURRENCY } from "../../constants/index.js";

const { ObjectId } = mongoose.Schema.Types;

const PAYMENT_METHOD = ["mobile_money", "card", "bank_transfer", "cash_on_delivery"];
const PAYMENT_STATUS = ["pending", "successful", "failed", "abandoned", "refunded"];

/**
 * A payment attempt against an Order. Deliberately NOT unique on
 * orderId — a failed attempt followed by a successful retry means more
 * than one Payment can legitimately belong to the same Order.
 */
const paymentSchemaDefinition = {
    orderId: {
        type: ObjectId,
        ref: "Order",
        required: [true, "Order id is required"],
    },
    userId: {
        type: ObjectId,
        ref: "User",
        required: [true, "User id is required"],
    },
    /** Minor units, matches Order.totalAmount at the time this payment was initiated. */
    amount: {
        type: Number,
        required: [true, "Amount is required"],
        min: [0, "Amount cannot be negative"],
        validate: { validator: Number.isInteger, message: "Amount must be an integer number of minor units" },
    },
    currency: {
        type: String,
        enum: Object.values(CURRENCY),
        default: CURRENCY.GHS,
    },
    method: {
        type: String,
        enum: PAYMENT_METHOD,
        required: [true, "Payment method is required"],
    },
    /** e.g. "Paystack", "Flutterwave" — the gateway that processed this payment. Null for cash_on_delivery. */
    provider: {
        type: String,
        trim: true,
        default: null,
    },
    /**
     * The channel the gateway actually reports back (e.g. "card",
     * "mobile_money", "bank", "ussd", "qr") — kept separate from
     * `method`, since checkout flows like Paystack's hosted page let
     * the buyer switch channels mid-flow. `method` is our upfront
     * guess/selection; this is the gateway's ground truth.
     */
    providerChannel: {
        type: String,
        trim: true,
        default: null,
    },
    /**
     * The payment gateway's own transaction reference — needed for
     * reconciliation (matching webhook events back to this record)
     * and idempotency. `sparse: true` is required alongside `unique`
     * here — without it, every payment with no reference yet would
     * share `null`, and the unique index would reject the second one.
     */
    providerReference: {
        type: String,
        trim: true,
        default: null,
        unique: true,
        sparse: true,
    },
    status: {
        type: String,
        enum: PAYMENT_STATUS,
        default: "pending",
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
    /**
     * Raw last-known gateway response (verify call or webhook
     * payload), kept as-is for reconciliation/dispute resolution.
     * Never exposed over the API; see the toJSON override below.
     */
    gatewayResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
};

const paymentSchema = createSchema(paymentSchemaDefinition);

paymentSchema.index({ orderId: 1 });
paymentSchema.index({ userId: 1 });
paymentSchema.index({ status: 1 });

paymentSchema.virtual("amountMajor").get(function () {
    return this.amount / 100;
});

/**
 * `gatewayResponse` is internal-only — not meant for client
 * consumption. Same local-override pattern as Product's toJSON.
 */
paymentSchema.set("toJSON", {
    virtuals: true,
    transform: (document, returnedObject) => {
        const transformed = transformDocument(document, returnedObject);
        delete transformed.gatewayResponse;
        return transformed;
    },
});

const Payment = mongoose.model("Payment", paymentSchema);
export { Payment };
