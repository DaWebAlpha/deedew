import { Ping } from "../../../models/index.js";
import { NotFoundError } from "../../../errors/index.js";

/** Returns a paginated page of non-deleted pings. */
const getAllActivePingsService = async ({
    filter = {},
    page = 1,
    limit = 50,
} = {}) => {
    const result = await Ping.paginate({
        filter: { ...filter, isDeleted: false },
        page,
        limit,
    });

    if (!result.data.length) {
        throw new NotFoundError({
            message: "No active pings exist yet",
            code: "NO_ACTIVE_PINGS_EXIST",
        });
    }

    return { result, message: "Active pings successfully retrieved" };
};

export { getAllActivePingsService };
