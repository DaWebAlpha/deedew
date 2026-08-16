import { RefreshToken } from "../../models/index.js";
import { fetchOrNotFound } from "../../utils/index.js";

/**
 * Revokes one of the current user's own sessions (scoped by userId so users can't revoke others').
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.sessionId
 * @returns {Promise<{message: string}>}
 * @throws {BadRequestError} If sessionId is missing.
 * @throws {NotFoundError} If no matching session exists for this user.
 */
const revokeSessionService = async ({ userId, sessionId } = {}) => {
    const session = await fetchOrNotFound(RefreshToken, sessionId, {
        idMessage: "Session id is required",
        idCode: "SESSION_ID_REQUIRED",
        notFoundMessage: "Session not found",
        notFoundCode: "SESSION_NOT_FOUND",
        filter: { userId },
    });

    if (session.isActive()) {
        await session.revoke();
    }

    return { message: "Session revoked successfully" };
};

export { revokeSessionService };
