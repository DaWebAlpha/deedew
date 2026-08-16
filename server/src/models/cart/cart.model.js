import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

/**
 * A User's one active cart. Deliberately NOT storing price here — a
 * cart is pre-purchase, so it should always reflect the live Product
 * price ("what am I considering right now"), not a locked-in number.
 * Price only gets snapshotted once, at Order creation.
 */
const cartSchemaDefinition = {
    userId: {
        type: ObjectId,
        ref: "User",
        required: [true, "User id is required"],
        unique: true,
    },
    items: {
        type: [
            {
                productId: {
                    type: ObjectId,
                    ref: "Product",
                    required: [true, "Product id is required"],
                },
                quantity: {
                    type: Number,
                    required: [true, "Quantity is required"],
                    min: [1, "Quantity must be at least 1"],
                },
            },
        ],
        default: [],
    },
};

const cartSchema = createSchema(cartSchemaDefinition);

cartSchema.index({ userId: 1 });

const Cart = mongoose.model("Cart", cartSchema);
export { Cart };
