import { User, RefreshToken } from "../../models/index.js";
import { BadRequestError, UnauthenticatedError } from "../../errors/index.js";
import { withTransaction } from "../../utils/index.js";
import { auditLogger } from "../../logger/pino.logger.js";

/** Verifies the current password, sets the new one, and revokes all sessions so every device must re-authenticate. */
const changePasswordService = async ({
    userId,
    currentPassword,
    newPassword,
} = {}) => {
    if (!currentPassword || !newPassword) {
        throw new BadRequestError({
            message: "Current password and new password are required",
            code: "MISSING_PASSWORD_FIELDS",
        });
    }

    const user = await User.findById(userId).select("+password");

    if (!user || user.isDeleted) {
        throw new UnauthenticatedError({
            message: "Account no longer exists",
            code: "USER_NOT_FOUND",
        });
    }

    const isValidPassword = await user.comparePassword(currentPassword);

    if (!isValidPassword) {
        throw new BadRequestError({
            message: "Current password is incorrect",
            code: "INVALID_CURRENT_PASSWORD",
        });
    }

    return withTransaction(async (session) => {
        user.password = newPassword;
        await user.save({ session });

        await RefreshToken.updateMany(
            { userId, revokedAt: null },
            { $set: { revokedAt: new Date() } },
        ).session(session);

        auditLogger.info(
            { userId },
            "Password changed, all sessions revoked",
        );

        return { message: "Password changed successfully. Please log in again." };
    });
};

export { changePasswordService };
