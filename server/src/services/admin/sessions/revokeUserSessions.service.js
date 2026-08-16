import { RefreshToken, User } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";
import { auditLogger } from "../../../logger/pino.logger.js";

/**
 * Revokes every active refresh-token session belonging to a user.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.revokedByUserId]
 * @returns {Promise<{message: string, revokedCount: number}>}
 * @throws {BadRequestError} If userId is missing.
 * @throws {NotFoundError} If no user matches.
 */
const revokeUserSessionsService = async ({
    userId,
    revokedByUserId = null,
} = {}) => {
    await fetchOrNotFound(User, userId, {
        idMessage: "UserId is required",
        idCode: "USER_ID_REQUIRED",
        notFoundMessage: "No user exists",
        notFoundCode: "NO_USER_EXISTS",
    });

    const result = await RefreshToken.updateMany(
        { userId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
    );

    auditLogger.info(
        { userId, revokedBy: revokedByUserId, revokedCount: result.modifiedCount },
        "All user sessions revoked by admin",
    );

    return { message: "All sessions revoked successfully", revokedCount: result.modifiedCount };
};

export { revokeUserSessionsService };
