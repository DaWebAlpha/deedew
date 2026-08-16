import {
    User,
    UserSecurity,
    LoginLog,
} from "../../models/index.js";

import {
    generateAccessToken,
    generateRefreshToken,
    withTransaction,
    normalizeEmail,
    normalizePhoneNumber,
} from "../../utils/index.js";

import {
    UnauthenticatedError,
    BadRequestError,
    ForbiddenError,
} from "../../errors/index.js";

import {
    auditLogger,
} from "../../logger/pino.logger.js";

const resolveId = (doc) => doc?._id ?? doc?.id ?? null;

/**
 * Authenticates by email or phone number, enforcing ban/suspension/lockout
 * checks and logging every attempt (success or failure) to LoginLog.
 * @param {object} params
 * @param {string} params.identifier - Email or phone number.
 * @param {string} params.password
 * @param {string} [params.userAgent]
 * @param {string} [params.ipAddress]
 * @param {string} [params.deviceName]
 * @param {string} [params.deviceId]
 * @returns {Promise<{user: import("mongoose").Document, security: import("mongoose").Document, accessToken: string, refreshToken: string, message: string}>}
 * @throws {BadRequestError} If identifier or password is missing.
 * @throws {UnauthenticatedError} If credentials are invalid.
 * @throws {ForbiddenError} If the account is banned, suspended, or temporarily locked out.
 */
const loginUserService = async ({
    identifier,
    password,
    userAgent = null,
    ipAddress = null,
    deviceName = null,
    deviceId = null,
} = {}) => {
    if (!identifier || !password) {
        throw new BadRequestError({
            message: "Enter either email or phone number and password",
            code: "EMAIL_OR_PHONE_AND_PASSWORD_REQUIRED",
        });
    }

    const normalizedIdentifier = identifier.includes("@")
        ? normalizeEmail(identifier)
        : normalizePhoneNumber(identifier, "GH")?.e164;

    const invalidCredentials = () => new UnauthenticatedError({
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
    });

    const recordFailedAttempt = (userId, reason = "INVALID_CREDENTIALS") => LoginLog.create({
        userId: userId ?? null,
        identifier,
        success: false,
        reason,
        deviceName,
        deviceId,
        userAgent,
        ipAddress,
    });

    if (!normalizedIdentifier) {
        await recordFailedAttempt(null);
        throw invalidCredentials();
    }

    const user = await User.findOne({
        $or: [{ email: normalizedIdentifier }, { phoneNumber: normalizedIdentifier }],
    }).select("+password");

    if (!user) {
        await recordFailedAttempt(null);
        throw invalidCredentials();
    }

    const userId = resolveId(user);

    if (!userId) {
        await recordFailedAttempt(null);
        throw invalidCredentials();
    }

    const security = await UserSecurity.findOrCreateForUser(userId);

    if (security.isBanned) {
        auditLogger.warn(
            { userId, deviceId },
            "Login attempted on banned account",
        );

        await recordFailedAttempt(userId, "ACCOUNT_BANNED");

        throw new ForbiddenError({
            message: "This account has been banned.",
            code: "ACCOUNT_BANNED",
        });
    }

    if (security.isSuspended()) {
        auditLogger.warn(
            { userId, deviceId },
            "Login attempted on suspended account",
        );

        await recordFailedAttempt(userId, "ACCOUNT_SUSPENDED");

        throw new ForbiddenError({
            message: `This account is suspended until ${security.suspendedUntil.toISOString()}.`,
            code: "ACCOUNT_SUSPENDED",
        });
    }

    if (security.isLocked()) {
        auditLogger.warn(
            { userId, deviceId },
            "Login attempted on locked account",
        );

        await recordFailedAttempt(userId, "ACCOUNT_TEMPORARILY_LOCKED");

        throw new ForbiddenError({
            message: "Account is temporarily suspended. Please try again later",
            code: "ACCOUNT_TEMPORARILY_LOCKED",
        });
    }

    const isValidPassword = await user.comparePassword(password);

    if (!isValidPassword) {
        await security.registerFailedAttempt();
        await recordFailedAttempt(userId);
        throw invalidCredentials();
    }

    return withTransaction(async (session) => {
        await security.registerSuccessfulLogin({ ipAddress, session });

        const accessToken = await generateAccessToken(userId.toString());

        const refreshToken = await generateRefreshToken({
            userId,
            deviceName,
            deviceId,
            userAgent,
            ipAddress,
            session,
        });

        auditLogger.info(
            { userId, deviceId },
            "User logged in",
        );

        await LoginLog.create(
            [{
                userId,
                identifier,
                success: true,
                deviceName,
                deviceId,
                userAgent,
                ipAddress,
            }],
            { session },
        );

        return {
            user,
            security,
            accessToken,
            refreshToken,
            message: "Login successful",
        };
    });
};

export { loginUserService };
