import { Product } from "../../models/index.js";
import { fetchOrNotFound } from "../../utils/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

/** Restores a soft-deleted product. */
const restoreProductService = async ({
    productId,
    restoreUserId = null,
    reason = null,
} = {}) => {
    const product = await fetchOrNotFound(Product, productId, {
        idMessage: "Product Id is required",
        idCode: "PRODUCT_ID_REQUIRED",
        notFoundMessage: "No product exists to restore",
        notFoundCode: "NO_PRODUCT_EXISTS_TO_RESTORE",
    });

    await product.restore({ restoreUserId, reason });

    auditLogger.info(
        { productId, restoredBy: restoreUserId, reason },
        "Product successfully restored",
    );

    return {
        message: "Product successfully restored",
    };
};

export {
    restoreProductService,
};
