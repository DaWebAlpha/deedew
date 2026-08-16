import mongoose from "mongoose";
import { mongooseSchemaOptions } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

const INVENTORY_CHANGE_TYPE = ["restock", "sale", "adjustment", "return", "reserved", "released"];

/**
 * One stock-quantity change on a Product — an immutable audit trail,
 * same reasoning as LoginLog: built directly on mongoose.Schema
 * instead of createSchema(), no soft-delete, since a stock ledger must
 * stay append-only to be trustworthy. Not from the reference project
 * — an original addition.
 */
const inventoryLogSchemaDefinition = {
    productId: {
        type: ObjectId,
        ref: "Product",
        required: [true, "Product id is required"],
    },
    changeType: {
        type: String,
        enum: INVENTORY_CHANGE_TYPE,
        required: [true, "Change type is required"],
    },
    /** Positive for increases (restock, return, released), negative for decreases (sale, reserved). */
    quantityChange: {
        type: Number,
        required: [true, "Quantity change is required"],
    },
    /** Snapshot of stockQuantity right after this change, for audit without recomputing history. */
    resultingStock: {
        type: Number,
        required: [true, "Resulting stock is required"],
        min: [0, "Resulting stock cannot be negative"],
    },
    orderId: {
        type: ObjectId,
        ref: "Order",
        default: null,
    },
    performedBy: {
        type: ObjectId,
        ref: "User",
        default: null,
    },
    note: {
        type: String,
        trim: true,
        default: null,
    },
};

const inventoryLogSchema = new mongoose.Schema(inventoryLogSchemaDefinition, {
    ...mongooseSchemaOptions,
    timestamps: { createdAt: true, updatedAt: false },
});

inventoryLogSchema.index({ productId: 1, createdAt: -1 });

const InventoryLog = mongoose.model("InventoryLog", inventoryLogSchema);
export { InventoryLog };
