import { User, UserSecurity, RefreshToken } from "../../../models/index.js";
import { fetchOrNotFound, withTransaction } from "../../../utils/index.js";
import { BadRequestError } from "../../../errors/index.js";
import { auditLogger } from "../../../logger/pino.logger.js";

/**
 * Suspends a user until a validated future date and revokes their active sessions, in one transaction.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.suspendedByUserId]
 * @param {string} [params.reason]
 * @param {string|Date} params.suspendedUntil - Must be a valid, future date.
 * @returns {Promise<{message: string, suspendedUntil: Date}>}
 * @throws {BadRequestError} If suspendedUntil is missing, invalid, or not in the future.
 * @throws {NotFoundError} If no user matches userId.
 */
const suspendUserService = async ({
    userId,
    suspendedByUserId = null,
    reason = null,
    suspendedUntil,
} = {}) => {
    const until = new Date(suspendedUntil);

    if (!suspendedUntil || Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
        throw new BadRequestError({
            message: "suspendedUntil must be a valid future date",
            code: "INVALID_SUSPENSION_DATE",
        });
    }

    await fetchOrNotFound(User, userId, {
        idMessage: "UserId is required",
        idCode: "USER_ID_REQUIRED",
        notFoundMessage: "No user exists to suspend",
        notFoundCode: "NO_USER_EXISTS_TO_SUSPEND",
    });

    return withTransaction(async (session) => {
        const security = await UserSecurity.findOrCreateForUser(userId, { session });

        await security.suspend({ suspendedByUserId, reason, until, session });

        await RefreshToken.updateMany(
            { userId, revokedAt: null },
            { $set: { revokedAt: new Date() } },
        ).session(session);

        auditLogger.info(
            { userId, suspendedBy: suspendedByUserId, reason, suspendedUntil: until },
            "User suspended",
        );

        return { message: "User suspended successfully", suspendedUntil: until };
    });
};

export { suspendUserService };
