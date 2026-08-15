import { Product } from "../../models/index.js";
import { fetchOrNotFound } from "../../utils/index.js";

/** Fetches a single product by id or throws NotFoundError. */
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
