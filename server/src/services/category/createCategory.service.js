import { Category } from "../../models/index.js";
import { normalizeText } from "../../utils/index.js";
import { BadRequestError, ConflictError } from "../../errors/index.js";
import {
    auditLogger
} from "../../logger/pino.logger.js";

/**
 * Creates a category, rejecting case-insensitive duplicate names.
 * @param {object} params
 * @param {string} params.categoryName
 * @param {string} [params.description]
 * @param {string} [params.image]
 * @param {string} [params.parentId] - Parent category id, for a nested category tree.
 * @returns {Promise<{category: import("mongoose").Document, message: string}>}
 * @throws {BadRequestError} If categoryName is missing or fails schema validation.
 * @throws {ConflictError} If a category with the same name (case-insensitive) already exists.
 */
const createCategoryService = async({
    categoryName,
    description = null,
    image = null,
    parentId = null,
} = {}) => {

    if(!categoryName){
        throw new BadRequestError({
            message: "Category name is required",
            code: "CATEGORY_NAME_IS_REQUIRED"
        })
    }

    const normalizedCategoryName = normalizeText(categoryName);

    const categoryNameExists = await Category.exists({
        categoryName: normalizedCategoryName
    }).collation({ locale: "en", strength: 2 });

    if(categoryNameExists){
        throw new ConflictError({
            message: "Category name exists",
            code: "CATEGORY_NAME_EXISTS",
        })
    }

    let category;

    try {
        category = await Category.create({
            categoryName: normalizedCategoryName,
            description,
            parentId,
            image,
        })
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
        {
            categoryId: category._id,
            categoryName: category.categoryName,
        },
        "Category has been created"
    )
    return {
        category,
        message: "Category has been created",
    }
}

export {
    createCategoryService,
}
