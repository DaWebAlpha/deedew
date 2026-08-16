import { RefreshToken } from "../../../models/index.js";
import { NotFoundError, BadRequestError } from "../../../errors/index.js";

/**
 * Returns a paginated page of one user's active sessions.
 * @param {object} params
 * @param {string} params.userId
 * @param {number} [params.page=1]
 * @param {number} [params.limit=50]
 * @returns {Promise<{result: object, message: string}>}
 * @throws {BadRequestError} If userId is missing.
 * @throws {NotFoundError} If no active sessions exist for this user.
 */
const getUserSessionsService = async ({
    userId,
    page = 1,
    limit = 50,
} = {}) => {
    if (!userId) {
        throw new BadRequestError({
            message: "UserId is required",
            code: "USER_ID_REQUIRED",
        });
    }

    const result = await RefreshToken.paginate({
        filter: { userId, revokedAt: null, expiresAt: { $gt: new Date() } },
        page,
        limit,
        options: { sort: { createdAt: -1 } },
    });

    if (!result.data.length) {
        throw new NotFoundError({
            message: "No active sessions exist for this user",
            code: "NO_ACTIVE_SESSIONS_EXIST_FOR_USER",
        });
    }

    return { result, message: "User sessions successfully retrieved" };
};

export { getUserSessionsService };
