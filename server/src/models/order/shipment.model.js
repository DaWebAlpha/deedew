import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

const SHIPMENT_STATUS = ["awaiting_pickup", "picked_up", "in_transit", "out_for_delivery", "delivered", "failed_delivery", "returned"];

/**
 * Delivery-tracking detail for one Order — finer-grained than
 * Order.status, with a carrier/tracking number and an event timeline.
 * One shipment per order. Not from the reference project — an
 * original addition.
 */
const shipmentSchemaDefinition = {
    orderId: {
        type: ObjectId,
        ref: "Order",
        required: [true, "Order id is required"],
        unique: true,
    },
    carrier: {
        type: String,
        trim: true,
        default: null,
    },
    trackingNumber: {
        type: String,
        trim: true,
        default: null,
    },
    currentStatus: {
        type: String,
        enum: SHIPMENT_STATUS,
        default: "awaiting_pickup",
    },
    estimatedDeliveryAt: {
        type: Date,
        default: null,
    },
    deliveredAt: {
        type: Date,
        default: null,
    },
    /** Append-only timeline of status changes, oldest first. */
    events: {
        type: [
            {
                status: { type: String, enum: SHIPMENT_STATUS, required: [true, "Event status is required"] },
                note: { type: String, trim: true, default: null },
                occurredAt: { type: Date, default: Date.now },
            },
        ],
        default: [],
    },
};

const shipmentSchema = createSchema(shipmentSchemaDefinition);

shipmentSchema.index({ orderId: 1 });
shipmentSchema.index({ trackingNumber: 1 });

const Shipment = mongoose.model("Shipment", shipmentSchema);
export { Shipment };
