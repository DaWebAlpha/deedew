import { User } from "../../../models/index.js";
import { NotFoundError } from "../../../errors/index.js";
import { buildSearchFilter } from "../../../utils/index.js";


/** Returns a paginated page of every user, active and deleted, filterable. */
const getAllUsersIncludingDeletedService = async (
    {
        role,
        search,
        page = 1,
        limit = 50,

} = {}) => {
    const result = await User.paginate({
        filter: {
            ...buildSearchFilter({ search, fields: ["firstName", "lastName", "email"], exact: { role } }),
            isDeleted: { $in: [true, false] }
        },
        page,
        limit,
    })

    if(!result.data.length){
        throw new NotFoundError({
            message: "No users exist yet",
            code: "NO_USERS_EXIST"
        })
    }

    return{
        result,
        message: "Users successfully retrieved",
    }
}

export {
    getAllUsersIncludingDeletedService
}
