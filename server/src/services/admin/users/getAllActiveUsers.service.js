import { User } from "../../../models/index.js";
import { NotFoundError } from "../../../errors/index.js";
import { buildSearchFilter } from "../../../utils/index.js";


/** Returns a paginated page of non-deleted users, filterable by role/search. */
const getAllActiveUsersService = async ({
    role,
    search,
    page = 1,
    limit = 50
} = {}) => {
    const result = await User.paginate({
        filter: {
            ...buildSearchFilter({ search, fields: ["firstName", "lastName", "email"], exact: { role } }),
            isDeleted: false
        },
        page,
        limit
    })

    if(!result.data.length){
        throw new NotFoundError({
            message: "No active users exist yet",
            code: "NO_ACTIVE_USERS_EXIST"
        })
    }

    return{
            result,
            message: "Active users successfully retrieved",
    }
}

export {
    getAllActiveUsersService
}
