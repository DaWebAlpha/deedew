import { fetchOrNotFound } from "../../utils/index.js";
import { Category } from "../../models/index.js";

import { auditLogger } from "../../logger/pino.logger.js";

/**
 * Soft-deletes a category.
 * @param {object} params
 * @param {string} params.categoryId
 * @param {string} [params.deletedByUserId]
 * @param {string} [params.reason]
 * @returns {Promise<{message: string}>}
 * @throws {BadRequestError} If categoryId is missing.
 * @throws {NotFoundError} If no category matches.
 */
const deleteCategoryService = async ({
    categoryId,
    deletedByUserId = null,
    reason = null
} = {}) => {
    const category = await fetchOrNotFound(
        Category, 
        categoryId,
        {
            idMessage: "Category Id is required",
            idCode: "CATEGORY_ID_REQUIRED",
            notFoundMessage: "Category not found",
            notFoundCode: "CATEGORY_NOT_FOUND",
        }
    );

    await category.softDelete({
        deletedByUserId,
        reason
    })

    auditLogger.info(
        {
            deletedBy: deletedByUserId,
            categoryDeleted: categoryId,
            reason,
        },
        "Category successfully deleted"

    )

    return {
        message: "Category successfully deleted"
    }
}

export {
    deleteCategoryService,
}