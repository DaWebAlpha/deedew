import mongoose from "mongoose";
import { createSchema } from "../base/index.js";
import { generateSlug, normalizeText, SLUG_SUFFIX_LENGTH } from "../../utils/index.js";

const { ObjectId } = mongoose.Schema.Types;

const PRODUCT_NAME_MAX_LENGTH = 200;

/**
 * A listing under a Category. No unique-name constraint (unlike
 * Category) — many real products legitimately share a name.
 */
const productSchemaDefinition = {
    productName: {
        type: String,
        trim: true,
        required: [true, "Product name is required"],
        maxlength: [PRODUCT_NAME_MAX_LENGTH, "Product name is too long"],
    },
    slug: {
        type: String,
        trim: true,
        lowercase: true,
        unique: true,
        immutable: true,
        maxlength: [PRODUCT_NAME_MAX_LENGTH + SLUG_SUFFIX_LENGTH, "Slug is too long"],
    },
    description: {
        type: String,
        trim: true,
        maxlength: [2000, "Description is too long"],
        default: null,
    },
    categoryId: {
        type: ObjectId,
        ref: "Category",
        required: [true, "Category is required"],
    },
    sellerId: {
        type: ObjectId,
        ref: "SellerProfile",
        required: [true, "Seller is required"],
    },
    price: {
        type: Number,
        required: [true, "Price is required"],
        min: [0, "Price cannot be negative"],
    },
    stockQuantity: {
        type: Number,
        default: 0,
        min: [0, "Stock quantity cannot be negative"],
    },
    images: {
        type: [String],
        default: [],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    displayOrder: {
        type: Number,
        default: 0,
    },
};

const productSchema = createSchema(productSchemaDefinition);

productSchema.index({ categoryId: 1 });
productSchema.index({ sellerId: 1 });

productSchema.pre("validate", function () {
    if (this.isNew && !this.slug && this.productName) {
        this.slug = generateSlug(this.productName);
    }
});

productSchema.pre("save", function () {
    if (this.isModified("productName") && this.productName) {
        this.productName = normalizeText(this.productName);
    }

    if (this.isModified("description") && this.description) {
        this.description = normalizeText(this.description);
    }
});

const Product = mongoose.model("Product", productSchema);

export { Product };
