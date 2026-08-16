import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

/**
 * A User's saved-for-later products — one document per user, mirroring
 * Cart's shape. Not from the reference project — an original addition.
 */
const wishlistSchemaDefinition = {
    userId: {
        type: ObjectId,
        ref: "User",
        required: [true, "User id is required"],
        unique: true,
    },
    productIds: {
        type: [{ type: ObjectId, ref: "Product" }],
        default: [],
    },
};

const wishlistSchema = createSchema(wishlistSchemaDefinition);

wishlistSchema.index({ userId: 1 });

const Wishlist = mongoose.model("Wishlist", wishlistSchema);
export { Wishlist };
