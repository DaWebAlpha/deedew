import { Product } from "../../models/index.js";
import { fetchOrNotFound } from "../../utils/index.js";

/**
 * Fetches a single product by id or throws NotFoundError.
 * @param {object} params
 * @param {string} params.productId
 * @returns {Promise<{product: import("mongoose").Document}>}
 * @throws {BadRequestError} If productId is missing.
 * @throws {NotFoundError} If no product matches.
 */
const getProductService = async ({ productId } = {}) => {
    const product = await fetchOrNotFound(Product, productId, {
        idMessage: "Product Id is required",
        idCode: "PRODUCT_ID_REQUIRED",
        notFoundMessage: "Product not found",
        notFoundCode: "PRODUCT_NOT_FOUND",
    });

    return { product };
};

export {
    getProductService,
};
