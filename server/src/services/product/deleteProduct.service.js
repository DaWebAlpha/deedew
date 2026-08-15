import { Product } from "../../models/index.js";
import { fetchOrNotFound } from "../../utils/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

/** Soft-deletes a product. */
const deleteProductService = async ({
    productId,
    deletedByUserId = null,
    reason = null,
} = {}) => {
    const product = await fetchOrNotFound(Product, productId, {
        idMessage: "Product Id is required",
        idCode: "PRODUCT_ID_REQUIRED",
        notFoundMessage: "Product not found",
        notFoundCode: "PRODUCT_NOT_FOUND",
    });

    await product.softDelete({ deletedByUserId, reason });

    auditLogger.info(
        { deletedBy: deletedByUserId, productDeleted: productId, reason },
        "Product successfully deleted",
    );

    return {
        message: "Product successfully deleted",
    };
};

export {
    deleteProductService,
};
