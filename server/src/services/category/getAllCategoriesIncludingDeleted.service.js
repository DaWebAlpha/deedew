import { Category } from "../../models/index.js";
import { NotFoundError } from "../../errors/index.js";
import { buildSearchFilter } from "../../utils/index.js";


/**
 * Returns a paginated page of every category, active and deleted.
 * @param {object} [params]
 * @param {string} [params.search] - Free-text search across categoryName/description.
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @returns {Promise<{result: object, message: string}>}
 * @throws {NotFoundError} If no categories exist at all.
 */
const getAllCategoriesIncludingDeletedService = async ({
    search,
    page = 1,
    limit = 50
} = {}) => {
    const result = await Category.paginate({
        filter: {
            ...buildSearchFilter({ search, fields: ["categoryName", "description"] }),
            isDeleted: { $in: [true, false] }
        },
        page,
        limit
    })

    if(!result.data.length){
        throw new NotFoundError({
            message: "No categories exist yet",
            code: "NO_CATEGORIES_EXIST"
        })
    }

    return{
        result,
        message: "Categories successfully retrieved",
    }
}

export {
    getAllCategoriesIncludingDeletedService
}
