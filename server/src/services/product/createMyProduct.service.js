import { SellerProfile } from "../../models/index.js";
import { ForbiddenError } from "../../errors/index.js";
import { createProductService } from "./createProduct.service.js";

/**
 * Self-service: creates a product owned by the caller's own
 * SellerProfile. sellerId is always derived from the caller's own
 * profile, never trusted from the request body — otherwise any seller
 * could list a product under someone else's shop.
 * @param {object} params
 * @param {string} params.userId - The authenticated caller's own user id.
 * @param {string} params.productName
 * @param {string} [params.description]
 * @param {string} params.categoryId
 * @param {number} params.price
 * @param {number} [params.stockQuantity=0]
 * @param {string[]} [params.images]
 * @returns {Promise<{product: import("mongoose").Document, message: string}>}
 * @throws {ForbiddenError} If the caller has no active SellerProfile yet.
 * @throws {BadRequestError} If a required field is missing or categoryId doesn't point to a live category.
 */
const createMyProductService = async ({ userId, ...productFields } = {}) => {
    const sellerProfile = await SellerProfile.findOne({ userId, isDeleted: false });

    if (!sellerProfile) {
        throw new ForbiddenError({
            message: "You must create a seller profile before listing products",
            code: "SELLER_PROFILE_REQUIRED",
        });
    }

    return createProductService({
        ...productFields,
        sellerId: sellerProfile._id,
    });
};

export { createMyProductService };
