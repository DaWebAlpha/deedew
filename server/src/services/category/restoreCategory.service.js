import { Category } from "../../models/index.js";
import { fetchOrNotFound } from "../../utils/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

/**
 * Restores a soft-deleted category.
 * @param {object} params
 * @param {string} params.categoryId
 * @param {string} [params.restoreUserId]
 * @param {string} [params.reason]
 * @returns {Promise<{message: string}>}
 * @throws {BadRequestError} If categoryId is missing.
 * @throws {NotFoundError} If no category matches.
 */
const restoreCategoryService = async ({
    categoryId,
    restoreUserId = null,
    reason = null,
} = {}) => {
    const category = await fetchOrNotFound(Category, categoryId, {
        idMessage: "Category Id is required",
        idCode: "CATEGORY_ID_REQUIRED",
        notFoundMessage: "No category exists to restore",
        notFoundCode: "NO_CATEGORY_EXISTS_TO_RESTORE",
    });

    await category.restore({ restoreUserId, reason });

    auditLogger.info(
        { categoryId, restoredBy: restoreUserId, reason },
        "Category successfully restored",
    );

    return {
        message: "Category successfully restored",
    };
};

export {
    restoreCategoryService,
};
