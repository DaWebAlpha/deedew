import { verifyAccessToken } from "../utils/index.js";
import { config } from "../config/index.js";
import { UnauthenticatedError } from "../errors/index.js";
import { User } from "../models/index.js";

/**
 * Verifies an access token and re-fetches the user from the database,
 * so a deleted/altered account loses access immediately rather than
 * waiting for the JWT to naturally expire.
 */
const resolveAuthenticatedUser = async (token) => {
    const decoded = await verifyAccessToken(token);

    const user = await User.findById(decoded.userId).select("role isSeller isDeleted");

    if (!user || user.isDeleted) {
        throw new UnauthenticatedError({
            message: "Account no longer exists",
            code: "USER_NOT_FOUND",
        });
    }

    return {
        userId: decoded.userId,
        role: user.role,
    };
};

/** Rejects the request with 401 unless a valid access token cookie is present. */
const authenticate = async (request, response, next) => {
    try {
        const token = request.cookies?.[config.accessTokenCookie];

        if (!token) {
            throw new UnauthenticatedError({
                message: "Authentication required",
                code: "AUTH_REQUIRED",
            });
        }

        request.user = await resolveAuthenticatedUser(token);

        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return next(new UnauthenticatedError({
                message: "Access token expired",
                code: "ACCESS_TOKEN_EXPIRED",
            }));
        }

        if (error.name === "JsonWebTokenError") {
            return next(new UnauthenticatedError({
                message: "Invalid access token",
                code: "INVALID_ACCESS_TOKEN",
            }));
        }

        next(error);
    }
};

/** Like authenticate, but never rejects — guests just proceed with no request.user. */
const optionalAuthenticate = async (request, response, next) => {
    try {
        const token = request.cookies?.[config.accessTokenCookie];

        if (!token) {
            return next();
        }

        request.user = await resolveAuthenticatedUser(token);

        next();
    } catch (error) {
        next();
    }
};

export { authenticate, optionalAuthenticate };
