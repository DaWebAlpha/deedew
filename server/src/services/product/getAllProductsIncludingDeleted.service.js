import { Product } from "../../models/index.js";
import { NotFoundError } from "../../errors/index.js";
import { buildSearchFilter } from "../../utils/index.js";


/** Returns a paginated page of every product, active and deleted. */
const getAllProductsIncludingDeletedService = async ({
    categoryId,
    search,
    page = 1,
    limit = 50
} = {}) => {
    const result = await Product.paginate({
        filter: {
            ...buildSearchFilter({ search, fields: ["productName", "description"], exact: { categoryId } }),
            isDeleted: { $in: [true, false] }
        },
        page,
        limit
    })

    if(!result.data.length){
        throw new NotFoundError({
            message: "No products exist yet",
            code: "NO_PRODUCTS_EXIST"
        })
    }

    return{
            result,
            message: "Products successfully retrieved",
    }
}

export {
    getAllProductsIncludingDeletedService
}
