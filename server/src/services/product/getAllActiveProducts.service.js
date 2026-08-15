import { Product } from "../../models/index.js";
import { NotFoundError } from "../../errors/index.js";
import { buildSearchFilter } from "../../utils/index.js";


/** Returns a paginated page of non-deleted products, filterable by category and searchable. */
const getAllActiveProductsService = async ({
    categoryId,
    search,
    page = 1,
    limit = 50
} = {}) => {
    const result = await Product.paginate({
        filter: {
            ...buildSearchFilter({ search, fields: ["productName", "description"], exact: { categoryId } }),
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
