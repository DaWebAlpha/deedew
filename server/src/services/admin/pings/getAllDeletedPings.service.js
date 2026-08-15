import { Ping } from "../../../models/index.js";
import { NotFoundError } from "../../../errors/index.js";

/** Returns a paginated page of soft-deleted pings. */
const getAllDeletedPingsService = async ({
    filter = {},
    page = 1,
    limit = 50,
} = {}) => {
    const result = await Ping.paginate({
        filter: { ...filter, isDeleted: true },
        page,
        limit,
    });

    if (!result.data.length) {
        throw new NotFoundError({
            message: "No deleted pings exist yet",
            code: "NO_DELETED_PINGS_EXIST",
        });
    }

    return { result, message: "Deleted pings successfully retrieved" };
};

export { getAllDeletedPingsService };
