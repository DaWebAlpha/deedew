import { Product, Category } from "../../models/index.js";
import { fetchOrNotFound } from "../../utils/index.js";
import { BadRequestError } from "../../errors/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

const UPDATABLE_FIELDS = ["productName", "description", "categoryId", "price", "stockQuantity", "images", "isActive", "displayOrder"];

/**
 * Applies a partial update to a product, re-validating categoryId if it changes.
 * @param {object} params
 * @param {string} params.productId
 * @param {string} [params.updatedByUserId]
 * @param {string} [params.productName]
 * @param {string} [params.description]
 * @param {string} [params.categoryId]
 * @param {number} [params.price]
 * @param {number} [params.stockQuantity]
 * @param {string[]} [params.images]
 * @param {boolean} [params.isActive]
 * @param {number} [params.displayOrder]
 * @returns {Promise<{product: import("mongoose").Document, message: string}>}
 * @throws {BadRequestError} If productId is missing, the update fails validation, or categoryId doesn't point to a live category.
 * @throws {NotFoundError} If no product matches productId.
 */
const updateProductService = async ({
    productId,
    updatedByUserId = null,
    ...updates
} = {}) => {
    const product = await fetchOrNotFound(Product, productId, {
        idMessage: "Product Id is required",
        idCode: "PRODUCT_ID_REQUIRED",
        notFoundMessage: "Product not found",
        notFoundCode: "PRODUCT_NOT_FOUND",
    });

    if (updates.categoryId !== undefined) {
        const categoryExists = await Category.exists({ _id: updates.categoryId, isDeleted: false });

        if (!categoryExists) {
            throw new BadRequestError({
                message: "No category exists for the given categoryId",
                code: "CATEGORY_DOES_NOT_EXIST",
            });
        }
    }

    for (const field of UPDATABLE_FIELDS) {
        if (updates[field] !== undefined) {
            product[field] = updates[field];
        }
    }

    product.updatedBy = updatedByUserId;

    try {
        await product.save();
    } catch (error) {
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((e) => e.message);
            throw new BadRequestError({ message: messages.join(", ") });
        }

        throw error;
    }

    auditLogger.info(
        { productId, updatedBy: updatedByUserId },
        "Product successfully updated",
    );

    return {
        product,
        message: "Product successfully updated",
    };
};

export {
    updateProductService,
};
