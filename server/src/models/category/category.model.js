import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

import { generateSlug, normalizeText, SLUG_SUFFIX_LENGTH } from "../../utils/index.js";

const { ObjectId } = mongoose.Schema.Types;

const CATEGORY_NAME_MAX_LENGTH = 200;

const categorySchemaDefinition = {
    categoryName: {
        type: String,
        trim: true,
        required: [true, "category name is required"],
        maxlength: [CATEGORY_NAME_MAX_LENGTH, "Category name is too long"],
    },
    slug: {
        type: String,
        trim: true,
        lowercase: true,
        unique: true,
        immutable: true,
        maxlength: [CATEGORY_NAME_MAX_LENGTH + SLUG_SUFFIX_LENGTH, "Slug is too long"]
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, "Description is too long"],
        default: null
    },
    parentId:{
        type: ObjectId,
        ref: "Category",
        default: null,
        validate: {
            validator: function (value) {
                return !value || !this._id || !value.equals(this._id);
            },
            message: "A category cannot be its own parent",
        },
    },
    image: {
        type: String,
        default: null,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    displayOrder: {
        type: Number,
        default: 0
    }

}

const categorySchema = createSchema(categorySchemaDefinition);

categorySchema.index({ parentId: 1 });

/**
 * Case-insensitive uniqueness, enforced natively by MongoDB instead
 * of maintaining a separate lowercase shadow field. strength: 2 means
 * "ignore case, but still distinguish accents" — the standard ICU
 * collation setting for case-insensitive comparison. This index is
 * what makes "Fresh Produce" and "fresh produce" collide as
 * duplicates directly on categoryName, with no extra field to keep
 * in sync, hide from JSON, or query separately.
 */
categorySchema.index(
    { categoryName: 1 },
    { unique: true, collation: { locale: "en", strength: 2 } },
);

categorySchema.pre("validate", function(){
    if(this.isNew && !this.slug && this.categoryName){
        this.slug = generateSlug(this.categoryName);
    }
})

categorySchema.pre("save", function(){
    /**
     * normalizeText, not just normalizeString — collapsing internal
     * whitespace runs ("Fresh  Produce" -> "Fresh Produce") matters
     * here specifically because the unique index's collation only
     * handles case/accent differences, not whitespace. Normalizing
     * the stored value itself is what keeps two whitespace-variant
     * submissions from being treated as different names.
     */
    if(this.isModified("categoryName") && this.categoryName){
        this.categoryName = normalizeText(this.categoryName);
    }

    if(this.isModified("description") && this.description){
        this.description = normalizeText(this.description);
    }
})

const Category = mongoose.model("Category", categorySchema);

export {
    Category
}
