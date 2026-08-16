import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

const CHECKOUT_STATUS = ["pending", "completed", "expired", "cancelled"];

/**
 * A snapshot of one seller's portion of a cart at the moment a buyer
 * starts paying — Order.checkoutId points back here. Multi-vendor
 * carts split into one Checkout per seller, since each seller becomes
 * its own Order/Payment. Not from the reference project — Order
 * referenced a checkoutId that nothing ever created.
 */
const checkoutSchemaDefinition = {
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
            message: "Checkout must have at least one item",
        },
    },
    /** Minor units — sum of (price * quantity) across items. */
    totalAmount: {
        type: Number,
        required: [true, "Total amount is required"],
        min: [0, "Total amount cannot be negative"],
        validate: { validator: Number.isInteger, message: "Total amount must be an integer number of minor units" },
    },
    status: {
        type: String,
        enum: CHECKOUT_STATUS,
        default: "pending",
    },
    /** When a "pending" checkout session should be considered abandoned. */
    expiresAt: {
        type: Date,
        default: null,
    },
};

const checkoutSchema = createSchema(checkoutSchemaDefinition);

checkoutSchema.index({ userId: 1 });
checkoutSchema.index({ sellerId: 1 });
checkoutSchema.index({ status: 1 });

checkoutSchema.virtual("totalAmountMajor").get(function () {
    return this.totalAmount / 100;
});

const Checkout = mongoose.model("Checkout", checkoutSchema);
export { Checkout };
