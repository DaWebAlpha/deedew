import { Ping } from "../../../models/index.js";
import { fetchOrNotFound } from "../../../utils/index.js";

/**
 * Fetches a single ping by id or throws NotFoundError.
 * @param {object} params
 * @param {string} params.pingId
 * @returns {Promise<{ping: import("mongoose").Document}>}
 * @throws {BadRequestError} If pingId is missing.
 * @throws {NotFoundError} If no ping matches.
 */
const getPingService = async ({ pingId } = {}) => {
    const ping = await fetchOrNotFound(Ping, pingId, {
        idMessage: "PingId is required",
        idCode: "PING_ID_REQUIRED",
        notFoundMessage: "No ping exists",
        notFoundCode: "NO_PING_EXISTS",
    });

    return { ping };
};

export { getPingService };
