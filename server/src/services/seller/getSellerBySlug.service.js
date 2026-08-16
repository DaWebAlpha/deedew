import { SellerProfile } from "../../models/index.js";
import { NotFoundError, BadRequestError } from "../../errors/index.js";

/**
 * Fetches a single non-deleted seller by its slug.
 * @param {object} params
 * @param {string} params.slug
 * @returns {Promise<{seller: import("mongoose").Document}>}
 * @throws {BadRequestError} If slug is missing.
 * @throws {NotFoundError} If no active seller matches.
 */
const getSellerBySlugService = async ({ slug } = {}) => {
    if (!slug) {
        throw new BadRequestError({
            message: "Seller slug is required",
            code: "SELLER_SLUG_REQUIRED",
        });
    }

    const seller = await SellerProfile.findOne({ slug, isDeleted: false });

    if (!seller) {
        throw new NotFoundError({
            message: "Seller not found",
            code: "SELLER_NOT_FOUND",
        });
    }

    return { seller };
};

export {
    getSellerBySlugService,
};
