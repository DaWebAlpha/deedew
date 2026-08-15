import { LoginLog } from "../../../models/index.js";
import { NotFoundError } from "../../../errors/index.js";
import { paginateQuery } from "../../../utils/index.js";

/** Returns a paginated page of login logs across all users. */
const getUsersLoginLogsService = async (
    {
        filter = {},
        page = 1,
        limit = 50,

} = {}) => {
    const result = await paginateQuery({
        model: LoginLog,
        filter,
        page,
        limit,
    })

    if(!result.data.length){
        throw new NotFoundError({
            message: "No login logs exist yet",
            code: "NO_LOGIN_LOGS_EXIST"
        })
    }

    return{
        result,
        message: "All login logs successfully retrieved",
    }
}

export {
    getUsersLoginLogsService,
}
