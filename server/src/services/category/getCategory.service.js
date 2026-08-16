import { fetchOrNotFound } from "../../utils/index.js";
import { Category } from "../../models/index.js";

/**
 * Fetches a single category by id or throws NotFoundError.
 * @param {object} params
 * @param {string} params.categoryId
 * @returns {Promise<{category: import("mongoose").Document, message: string}>}
 * @throws {BadRequestError} If categoryId is missing.
 * @throws {NotFoundError} If no category matches.
 */
const getCategoryService = async ({
    categoryId,

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
    )

    return {
        category,
        message: "category retrieved"
    }
}

export { getCategoryService }