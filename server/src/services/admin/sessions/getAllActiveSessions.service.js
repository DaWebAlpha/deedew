import { RefreshToken } from "../../../models/index.js";
import { NotFoundError } from "../../../errors/index.js";

/**
 * Returns a paginated page of currently active refresh-token sessions, across all users.
 * @param {object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @returns {Promise<{result: object, message: string}>}
 * @throws {NotFoundError} If no active sessions exist.
 */
const getAllActiveSessionsService = async ({
    page = 1,
    limit = 50,
} = {}) => {
    const result = await RefreshToken.paginate({
        filter: { revokedAt: null, expiresAt: { $gt: new Date() } },
        page,
        limit,
        options: { sort: { createdAt: -1 } },
    });

    if (!result.data.length) {
        throw new NotFoundError({
            message: "No active sessions exist",
            code: "NO_ACTIVE_SESSIONS_EXIST",
        });
    }

    return { result, message: "Active sessions successfully retrieved" };
};

export { getAllActiveSessionsService };
