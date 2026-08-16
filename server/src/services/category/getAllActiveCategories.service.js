import { Category } from "../../models/index.js";
import { NotFoundError } from "../../errors/index.js";
import { buildSearchFilter } from "../../utils/index.js";


/**
 * Returns a paginated page of non-deleted categories, searchable by name/description.
 * @param {object} [params]
 * @param {string} [params.search] - Free-text search across categoryName/description.
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @returns {Promise<{result: object, message: string}>}
 * @throws {NotFoundError} If no active categories exist.
 */
const getAllActiveCategoriesService = async ({
    search,
    page = 1,
    limit = 50
} = {}) => {
    const result = await Category.paginate({
        filter: {
            ...buildSearchFilter({ search, fields: ["categoryName", "description"] }),
            isDeleted: false
        },
        page,
        limit
    })

    if(!result.data.length){
        throw new NotFoundError({
            message: "No active categories exist yet",
            code: "NO_ACTIVE_CATEGORIES_EXIST"
        })
    }

    return{
            result,
            message: "Active categories successfully retrieved",
    }
}

export {
    getAllActiveCategoriesService
}
