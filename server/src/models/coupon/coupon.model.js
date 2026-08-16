import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

const { ObjectId } = mongoose.Schema.Types;

const DISCOUNT_TYPE = ["percentage", "fixed"];

/**
 * A promo code, either platform-wide (sellerId null) or scoped to one
 * seller. discountValue is a percentage (0-100) when discountType is
 * "percentage", or minor units when "fixed". Not from the reference
 * project — an original addition.
 */
const couponSchemaDefinition = {
    code: {
        type: String,
        trim: true,
        uppercase: true,
        required: [true, "Coupon code is required"],
        unique: true,
        maxlength: [30, "Coupon code is too long"],
    },
    sellerId: {
        type: ObjectId,
        ref: "SellerProfile",
        default: null,
    },
    discountType: {
        type: String,
        enum: DISCOUNT_TYPE,
        required: [true, "Discount type is required"],
    },
    discountValue: {
        type: Number,
        required: [true, "Discount value is required"],
        min: [0, "Discount value cannot be negative"],
    },
    /** Minor units — an order must total at least this much to use the coupon. */
    minimumOrderAmount: {
        type: Number,
        default: 0,
        min: [0, "Minimum order amount cannot be negative"],
    },
    /** Minor units — caps the discount a "percentage" coupon can apply. Ignored for "fixed". */
    maxDiscountAmount: {
        type: Number,
        default: null,
    },
    /** Total redemptions allowed across all users; null means unlimited. */
    usageLimit: {
        type: Number,
        default: null,
    },
    usageCount: {
        type: Number,
        default: 0,
        min: [0, "Usage count cannot be negative"],
    },
    perUserLimit: {
        type: Number,
        default: 1,
        min: [1, "Per-user limit must be at least 1"],
    },
    startsAt: {
        type: Date,
        default: null,
    },
    expiresAt: {
        type: Date,
        default: null,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
};

const couponSchema = createSchema(couponSchemaDefinition);

couponSchema.index({ sellerId: 1 });
couponSchema.index({ isActive: 1, expiresAt: 1 });

const Coupon = mongoose.model("Coupon", couponSchema);
export { Coupon };
