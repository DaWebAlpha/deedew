import { User } from "../../../models/index.js";
import { NotFoundError } from "../../../errors/index.js";
import { buildSearchFilter } from "../../../utils/index.js";


/** Returns a paginated page of soft-deleted users, filterable by role/search. */
const getAllDeletedUsersService = async ({
    role,
    search,
    page = 1,
    limit = 50
} = {}) => {
    const result = await User.paginate({
        filter: {
            ...buildSearchFilter({ search, fields: ["firstName", "lastName", "email"], exact: { role } }),
            isDeleted: true
        },
        page,
        limit
    })

    if(!result.data.length){
        throw new NotFoundError({
            message: "No deleted users exist yet",
            code: "NO_DELETED_USERS_EXIST"
        })
    }

    return{
            result,
            message: "Deleted users successfully retrieved",
    }
}

export {
    getAllDeletedUsersService
}
