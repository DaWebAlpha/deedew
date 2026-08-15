import { Product } from "../../models/index.js";
import { NotFoundError } from "../../errors/index.js";
import { buildSearchFilter } from "../../utils/index.js";


/** Returns a paginated page of soft-deleted products, filterable by category and searchable. */
const getAllDeletedProductsService = async ({
    categoryId,
    search,
    page = 1,
    limit = 50
} = {}) => {
    const result = await Product.paginate({
        filter: {
            ...buildSearchFilter({ search, fields: ["productName", "description"], exact: { categoryId } }),
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
