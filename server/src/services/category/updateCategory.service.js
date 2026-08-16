import { Category } from "../../models/index.js";
import { fetchOrNotFound, normalizeText } from "../../utils/index.js";
import { BadRequestError, ConflictError } from "../../errors/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

const UPDATABLE_FIELDS = ["categoryName", "description", "image", "parentId", "isActive", "displayOrder"];

/**
 * Applies a partial update to a category, re-checking name uniqueness if categoryName changes.
 * @param {object} params
 * @param {string} params.categoryId
 * @param {string} [params.updatedByUserId]
 * @param {string} [params.categoryName]
 * @param {string} [params.description]
 * @param {string} [params.image]
 * @param {string} [params.parentId]
 * @param {boolean} [params.isActive]
 * @param {number} [params.displayOrder]
 * @returns {Promise<{category: import("mongoose").Document, message: string}>}
 * @throws {BadRequestError} If categoryId is missing or the update fails validation.
 * @throws {NotFoundError} If no category matches categoryId.
 * @throws {ConflictError} If categoryName is changed to one that already exists.
 */
const updateCategoryService = async ({
    categoryId,
    updatedByUserId = null,
    ...updates
} = {}) => {
    const category = await fetchOrNotFound(Category, categoryId, {
        idMessage: "Category Id is required",
        idCode: "CATEGORY_ID_REQUIRED",
        notFoundMessage: "Category not found",
        notFoundCode: "CATEGORY_NOT_FOUND",
    });

    if (updates.categoryName !== undefined) {
        const normalizedCategoryName = normalizeText(updates.categoryName);

        const duplicate = await Category.exists({
            _id: { $ne: category._id },
            categoryName: normalizedCategoryName,
        }).collation({ locale: "en", strength: 2 });

        if (duplicate) {
            throw new ConflictError({
                message: "Category name exists",
                code: "CATEGORY_NAME_EXISTS",
            });
        }

        updates.categoryName = normalizedCategoryName;
    }

    for (const field of UPDATABLE_FIELDS) {
        if (updates[field] !== undefined) {
            category[field] = updates[field];
        }
    }

    category.updatedBy = updatedByUserId;

    try {
        await category.save();
    } catch (error) {
        if (error.code === 11000) {
            throw new ConflictError({
                message: "Category name exists",
                code: "CATEGORY_NAME_EXISTS",
            });
        }

        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((e) => e.message);
            throw new BadRequestError({ message: messages.join(", ") });
        }

        throw error;
    }

    auditLogger.info(
        { categoryId, updatedBy: updatedByUserId },
        "Category successfully updated",
    );

    return {
        category,
        message: "Category successfully updated",
    };
};

export {
    updateCategoryService,
};
