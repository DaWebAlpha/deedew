import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

/**
 * A verified-purchase review: tied to the Order that proves the
 * purchase happened, one review per order/product pair. sellerId is
 * denormalized from the product's seller so SellerProfile's
 * averageRating/reviewCount can be aggregated without populating
 * through Product on every query. Not from the reference project —
 * SellerProfile had rating fields but nothing fed them.
 */
const reviewSchemaDefinition = {
    userId: {
        type: ObjectId,
        ref: "User",
        required: [true, "User id is required"],
    },
    productId: {
        type: ObjectId,
        ref: "Product",
        required: [true, "Product id is required"],
    },
    sellerId: {
        type: ObjectId,
        ref: "SellerProfile",
        required: [true, "Seller id is required"],
    },
    orderId: {
        type: ObjectId,
        ref: "Order",
        required: [true, "Order id is required"],
    },
    rating: {
        type: Number,
        required: [true, "Rating is required"],
        min: [1, "Rating must be at least 1"],
        max: [5, "Rating cannot exceed 5"],
    },
    comment: {
        type: String,
        trim: true,
        maxlength: [1000, "Comment is too long"],
        default: null,
    },
    images: {
        type: [String],
        default: [],
    },
    /** A seller's public reply to this review, if they left one. */
    sellerResponse: {
        body: { type: String, trim: true, maxlength: [500, "Response is too long"], default: null },
        respondedAt: { type: Date, default: null },
    },
};

const reviewSchema = createSchema(reviewSchemaDefinition);

reviewSchema.index({ productId: 1 });
reviewSchema.index({ sellerId: 1 });
/** One review per order/product pair — enforces "you can only review what you bought, once". */
reviewSchema.index({ orderId: 1, productId: 1 }, { unique: true });

const Review = mongoose.model("Review", reviewSchema);
export { Review };
