import { Category } from "../../models/index.js";
import { NotFoundError } from "../../errors/index.js";
import { buildSearchFilter } from "../../utils/index.js";


/** Returns a paginated page of soft-deleted categories. */
const getAllDeletedCategoriesService = async ({
    search,
    page = 1,
    limit = 50
} = {}) => {
    const result = await Category.paginate({
        filter: {
            ...buildSearchFilter({ search, fields: ["categoryName", "description"] }),
            isDeleted: true
        },
        page,
        limit
    })

    if(!result.data.length){
        throw new NotFoundError({
            message: "No deleted categories exist yet",
            code: "NO_DELETED_CATEGORIES_EXIST"
        })
    }

    return{
        result,
        message: "Deleted categories successfully retrieved",
    }
}

export {
    getAllDeletedCategoriesService
}
