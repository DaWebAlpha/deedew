import { Product } from "../../models/index.js";
import { NotFoundError, BadRequestError } from "../../errors/index.js";

/**
 * Fetches a single non-deleted product by its slug.
 * @param {object} params
 * @param {string} params.slug
 * @returns {Promise<{product: import("mongoose").Document}>}
 * @throws {BadRequestError} If slug is missing.
 * @throws {NotFoundError} If no active product matches.
 */
const getProductBySlugService = async ({ slug } = {}) => {
    if (!slug) {
        throw new BadRequestError({
            message: "Product slug is required",
            code: "PRODUCT_SLUG_REQUIRED",
        });
    }

    const product = await Product.findOne({ slug, isDeleted: false });

    if (!product) {
        throw new NotFoundError({
            message: "Product not found",
            code: "PRODUCT_NOT_FOUND",
        });
    }

    return { product };
};

export {
    getProductBySlugService,
};
