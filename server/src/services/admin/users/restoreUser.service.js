import { User } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";
import { auditLogger } from "../../../logger/pino.logger.js";

/**
 * Restores a soft-deleted user account.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.restoreUserId]
 * @param {string} [params.reason]
 * @returns {Promise<{message: string}>}
 * @throws {BadRequestError} If userId is missing.
 * @throws {NotFoundError} If no user matches.
 */
const restoreUserService = async ({
    userId,
    restoreUserId = null,
    reason = null,
} = {}) => {
    const user = await fetchOrNotFound(User, userId, {
        idMessage: "UserId is required",
        idCode: "USER_ID_REQUIRED",
        notFoundMessage: "No user exists to restore",
        notFoundCode: "NO_USER_EXISTS_TO_RESTORE",
    });

    await user.restore({
        restoreUserId,
        reason,
    });

    auditLogger.info(
        {
            restoredBy: restoreUserId,
            userRestored: userId,
            reason,
        },
        "User successfully restored",
    );

    return {
        message: "User successfully restored",
    };
};

export { restoreUserService };
