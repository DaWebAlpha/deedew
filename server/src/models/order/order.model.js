import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

const ORDER_STATUS = ["pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];

/**
 * A placed order. Items are snapshotted at creation — productName/price
 * copied from Product at THIS moment, never re-read live, so an order
 * stays accurate even if the seller later renames or re-prices the
 * product. Cart intentionally does the opposite (always live).
 */
const orderSchemaDefinition = {
    checkoutId: {
        type: ObjectId,
        required: [true, "Checkout id is required"],
    },
    userId: {
        type: ObjectId,
        ref: "User",
        required: [true, "User id is required"],
    },
    sellerId: {
        type: ObjectId,
        ref: "SellerProfile",
        required: [true, "Seller id is required"],
    },
    deliveryAddressId: {
        type: ObjectId,
        ref: "Address",
        required: [true, "Delivery address is required"],
    },
    items: {
        type: [
            {
                productId: { type: ObjectId, ref: "Product", required: [true, "Product id is required"] },
                productName: { type: String, required: [true, "Product name is required"] },
                /** Minor units, same convention as Product.price. */
                price: {
                    type: Number,
                    required: [true, "Price is required"],
                    min: [0, "Price cannot be negative"],
                    validate: { validator: Number.isInteger, message: "Price must be an integer number of minor units" },
                },
                quantity: { type: Number, required: [true, "Quantity is required"], min: [1, "Quantity must be at least 1"] },
            },
        ],
        validate: {
            validator: (value) => Array.isArray(value) && value.length > 0,
            message: "Order must have at least one item",
        },
    },
    /** Minor units — sum of (price * quantity) across items, computed once at order creation. */
    totalAmount: {
        type: Number,
        required: [true, "Total amount is required"],
        min: [0, "Total amount cannot be negative"],
        validate: { validator: Number.isInteger, message: "Total amount must be an integer number of minor units" },
    },
    status: {
        type: String,
        enum: ORDER_STATUS,
        default: "pending",
    },
};

const orderSchema = createSchema(orderSchemaDefinition);

orderSchema.index({ userId: 1 });
orderSchema.index({ sellerId: 1 });
orderSchema.index({ checkoutId: 1 });
orderSchema.index({ status: 1 });

orderSchema.virtual("totalAmountMajor").get(function () {
    return this.totalAmount / 100;
});

const Order = mongoose.model("Order", orderSchema);
export { Order };
