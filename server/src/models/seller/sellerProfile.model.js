import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

import { generateSlug, normalizeString, SLUG_SUFFIX_LENGTH } from "../../utils/index.js";

const { ObjectId } = mongoose.Schema.Types;

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const SHOP_NAME_MAX_LENGTH = 150;

/** A User's storefront: shop identity, verification state, location, payout details, and working hours. */
const sellerProfileSchemaDefinition = {
    userId: {
        type: ObjectId,
        ref: "User",
        required: [true, "User id is required"],
        unique: true,
    },
    shopName: {
        type: String,
        trim: true,
        required: [true, "Shop name is required"],
        maxlength: [SHOP_NAME_MAX_LENGTH, "Shop name is too long"],
    },
    slug: {
        type: String,
        trim: true,
        lowercase: true,
        unique: true,
        immutable: true,
        maxlength: [SHOP_NAME_MAX_LENGTH + SLUG_SUFFIX_LENGTH, "Slug is too long"]
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, "Description is too long"],
        default: null
    },
    verificationStatus: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "pending",
    },
    verifiedAt: {
        type: Date,
        default: null,
    },
    verifiedBy: {
        type: ObjectId,
        ref: "User",
        default: null,
    },
    rejectionReason: {
        type: String,
        trim: true,
        default: null,
    },
    region: { type: String, trim: true, default: null },
    city: { type: String, trim: true, default: null },
    location: {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point",
        },
        coordinates: {
            type: [Number],
            required: [true, "Location coordinates are required"],
        },
    },
    payoutMethod: {
        type: String,
        enum: ["mobile_money", "bank_transfer"],
        default: null,
    },
    payoutDetails: {
        provider: { type: String, trim: true, default: null },
        accountNumber: { type: String, trim: true, default: null },
        accountName: { type: String, trim: true, default: null },
    },
    averageRating: {
        type: Number,
        default: 0,
        min: [0, "Average rating cannot be negative"],
        max: [5, "Average rating cannot exceed 5"],
    },
    reviewCount: {
        type: Number,
        default: 0,
        min: [0, "Review count cannot be negative"],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    /**
     * Recurring weekly schedule — times stored as plain "HH:mm"
     * (24hr) strings, not Date, since this describes a repeating
     * weekly pattern with no calendar date attached.
     */
    workingHours: {
        type: [
            {
                day: {
                    type: String,
                    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
                    required: [true, "Day is required"],
                },
                openTime: {
                    type: String,
                    required: [true, "Open time is required"],
                    validate: {
                        validator: (value) => TIME_REGEX.test(value),
                        message: "Open time must be in HH:mm 24-hour format",
                    },
                },
                closeTime: {
                    type: String,
                    required: [true, "Close time is required"],
                    validate: {
                        validator: (value) => TIME_REGEX.test(value),
                        message: "Close time must be in HH:mm 24-hour format",
                    },
                },
                isClosed: {
                    type: Boolean,
                    default: false,
                },
            },
        ],
        default: [],
    },
}

const sellerProfileSchema = createSchema(sellerProfileSchemaDefinition);

sellerProfileSchema.index({ shopName: 1 });
sellerProfileSchema.index({ location: "2dsphere" });

sellerProfileSchema.pre("validate", function () {
    if (this.isNew && !this.slug && this.shopName) {
        this.slug = generateSlug(this.shopName);
    }
});

sellerProfileSchema.pre("save", function () {
    if (this.isModified("shopName") && this.shopName) {
        this.shopName = normalizeString(this.shopName);
    }
});

const SellerProfile = mongoose.model("SellerProfile", sellerProfileSchema);
export { SellerProfile };
