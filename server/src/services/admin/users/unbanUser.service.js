import { User, UserSecurity } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";
import { auditLogger } from "../../../logger/pino.logger.js";

/**
 * Lifts a ban on a user.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.unbannedByUserId]
 * @param {string} [params.reason]
 * @returns {Promise<{message: string}>}
 * @throws {BadRequestError} If userId is missing.
 * @throws {NotFoundError} If no user matches.
 */
const unbanUserService = async ({
    userId,
    unbannedByUserId = null,
    reason = null,
} = {}) => {
    await fetchOrNotFound(User, userId, {
        idMessage: "UserId is required",
        idCode: "USER_ID_REQUIRED",
        notFoundMessage: "No user exists to unban",
        notFoundCode: "NO_USER_EXISTS_TO_UNBAN",
    });

    const security = await UserSecurity.findOrCreateForUser(userId);

    await security.unban({ unbannedByUserId, reason });

    auditLogger.info(
        { userId, unbannedBy: unbannedByUserId, reason },
        "User unbanned",
    );

    return { message: "User unbanned successfully" };
};

export { unbanUserService };
