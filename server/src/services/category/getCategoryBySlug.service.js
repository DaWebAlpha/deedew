import { Category } from "../../models/index.js";
import { NotFoundError, BadRequestError } from "../../errors/index.js";

/**
 * Fetches a single non-deleted category by its slug.
 * @param {object} params
 * @param {string} params.slug
 * @returns {Promise<{category: import("mongoose").Document}>}
 * @throws {BadRequestError} If slug is missing.
 * @throws {NotFoundError} If no active category matches.
 */
const getCategoryBySlugService = async ({ slug } = {}) => {
    if (!slug) {
        throw new BadRequestError({
            message: "Category slug is required",
            code: "CATEGORY_SLUG_REQUIRED",
        });
    }

    const category = await Category.findOne({ slug, isDeleted: false });

    if (!category) {
        throw new NotFoundError({
            message: "Category not found",
            code: "CATEGORY_NOT_FOUND",
        });
    }

    return { category };
};

export {
    getCategoryBySlugService,
};
