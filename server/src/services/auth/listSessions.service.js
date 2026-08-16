import { RefreshToken } from "../../models/index.js";

/**
 * Returns a user's currently active (non-revoked, unexpired) sessions.
 * @param {object} params
 * @param {string} params.userId
 * @returns {Promise<{sessions: import("mongoose").Document[]}>}
 */
const listSessionsService = async ({ userId } = {}) => {
    const sessions = await RefreshToken.find({
        userId,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    return { sessions };
};

export { listSessionsService };
