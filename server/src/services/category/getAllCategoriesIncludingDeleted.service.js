import { Category } from "../../models/index.js";
import { NotFoundError } from "../../errors/index.js";
import { buildSearchFilter } from "../../utils/index.js";


/** Returns a paginated page of every category, active and deleted. */
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
