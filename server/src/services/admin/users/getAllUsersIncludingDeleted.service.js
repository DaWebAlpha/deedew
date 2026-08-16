import { User } from "../../../models/index.js";
import { NotFoundError } from "../../../errors/index.js";
import { buildSearchFilter } from "../../../utils/index.js";


/**
 * Returns a paginated page of every user, active and deleted, filterable by role/search.
 * @param {object} [params]
 * @param {"customer"|"admin"|"superadmin"} [params.role] - Exact-match filter.
 * @param {string} [params.search] - Free-text search across firstName/lastName/email.
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @returns {Promise<{result: object, message: string}>}
 * @throws {NotFoundError} If no users exist at all.
 */
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
