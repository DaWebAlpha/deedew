import { Product } from "../../models/index.js";
import { NotFoundError } from "../../errors/index.js";
import { buildSearchFilter } from "../../utils/index.js";


/**
 * Returns a paginated page of non-deleted products, filterable by category/seller and searchable.
 * @param {object} [params]
 * @param {string} [params.categoryId] - Exact-match filter.
 * @param {string} [params.sellerId] - Exact-match filter.
 * @param {string} [params.search] - Free-text search across productName/description.
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @returns {Promise<{result: object, message: string}>}
 * @throws {NotFoundError} If no active products match.
 */
const getAllActiveProductsService = async ({
    categoryId,
    sellerId,
    search,
    page = 1,
    limit = 50
} = {}) => {
    const result = await Product.paginate({
        filter: {
            ...buildSearchFilter({ search, fields: ["productName", "description"], exact: { categoryId, sellerId } }),
            isDeleted: false
        },
        page,
        limit
    })

    if(!result.data.length){
        throw new NotFoundError({
            message: "No active products exist yet",
            code: "NO_ACTIVE_PRODUCTS_EXIST"
        })
    }

    return{
            result,
            message: "Active products successfully retrieved",
    }
}

export {
    getAllActiveProductsService
}
