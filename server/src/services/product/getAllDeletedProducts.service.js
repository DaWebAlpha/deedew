import { Product } from "../../models/index.js";
import { NotFoundError } from "../../errors/index.js";
import { buildSearchFilter } from "../../utils/index.js";


/**
 * Returns a paginated page of soft-deleted products, filterable by category/seller and searchable.
 * @param {object} [params]
 * @param {string} [params.categoryId] - Exact-match filter.
 * @param {string} [params.sellerId] - Exact-match filter.
 * @param {string} [params.search] - Free-text search across productName/description.
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @returns {Promise<{result: object, message: string}>}
 * @throws {NotFoundError} If no deleted products match.
 */
const getAllDeletedProductsService = async ({
    categoryId,
    sellerId,
    search,
    page = 1,
    limit = 50
} = {}) => {
    const result = await Product.paginate({
        filter: {
            ...buildSearchFilter({ search, fields: ["productName", "description"], exact: { categoryId, sellerId } }),
            isDeleted: true
        },
        page,
        limit
    })

    if(!result.data.length){
        throw new NotFoundError({
            message: "No deleted products exist yet",
            code: "NO_DELETED_PRODUCTS_EXIST"
        })
    }

    return{
            result,
            message: "Deleted products successfully retrieved",
    }
}

export {
    getAllDeletedProductsService
}
