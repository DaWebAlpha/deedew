import { User } from "../../../models/index.js";
import { fetchOrNotFound }  from "../../../utils/index.js"
import { auditLogger } from "../../../logger/pino.logger.js";

/**
 * Soft-deletes a user account.
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.deletedByUserId]
 * @param {string} [params.reason]
 * @returns {Promise<{message: string}>}
 * @throws {BadRequestError} If userId is missing.
 * @throws {NotFoundError} If no user matches.
 */
const deleteUserService = async ({
    userId,
    deletedByUserId = null,
    reason = null
} = {}) => {

    const user = await fetchOrNotFound(User, userId);

    await user.softDelete({
        deletedByUserId,
        reason
    })

    auditLogger.info(
        {
            deletedBy: deletedByUserId,
            userDeleted: userId,
            reason,
        },
        "User successfully deleted"

    )

    return {
        message: "User successfully deleted"
    }
}

export {
    deleteUserService
}
