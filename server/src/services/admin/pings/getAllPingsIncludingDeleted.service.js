import { Ping } from "../../../models/index.js";
import { NotFoundError } from "../../../errors/index.js";

/** Returns a paginated page of every ping, active and deleted. */
const getAllPingsIncludingDeletedService = async ({
    filter = {},
    page = 1,
    limit = 50,
} = {}) => {
    const result = await Ping.paginate({
        filter: { ...filter, isDeleted: { $in: [true, false] } },
        page,
        limit,
    });

    if (!result.data.length) {
        throw new NotFoundError({
            message: "No pings exist yet",
            code: "NO_PINGS_EXIST",
        });
    }

    return { result, message: "Pings successfully retrieved" };
};

export { getAllPingsIncludingDeletedService };
