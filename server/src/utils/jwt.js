import jwt from "jsonwebtoken";
import {
    BadRequestError
} from "../errors/index.js";
import {
    normalizeString
} from "./normalizer.js"

import { config } from "../config/index.js";

/**
 * Signs a short-lived JWT access token carrying only the user's id.
 * The token is self-contained and stateless — verifying it later never
 * needs a database lookup to confirm the signature is genuine (though
 * `authenticate` middleware still re-checks the user exists/isn't
 * deleted on every request, since this token alone can't know that).
 * @param {string|import("mongoose").Types.ObjectId} userId - The user's id; stringified before signing.
 * @returns {Promise<string>} The signed JWT, valid for config.jwtAccessExpirySeconds.
 * @throws {BadRequestError} If userId is missing/empty after normalization.
 */
const generateAccessToken = async (userId) => {

    const normalizedUserId = normalizeString(userId);

    if(!normalizedUserId){
        throw new BadRequestError({
            message: "User id is required",
            code: "USER_ID_REQUIRED",
        })
    }
    return jwt.sign(
        {userId: normalizedUserId},
        config.jwtAccessSecret,
        {expiresIn: config.jwtAccessExpirySeconds},
    )
}

/**
 * Verifies a JWT access token's signature and expiry, returning its
 * decoded payload. Throws jsonwebtoken's own error types
 * (TokenExpiredError, JsonWebTokenError) on an invalid/expired token —
 * `authenticate` middleware is what translates those into clean
 * UnauthenticatedError responses.
 * @param {string} token - The raw JWT to verify.
 * @returns {Promise<{userId: string, iat: number, exp: number}>} The decoded token payload.
 * @throws {BadRequestError} If token isn't a non-empty string.
 */
const verifyAccessToken = async (token) => {

    if (
            typeof token !== "string" ||
            token.trim() === ""
    ) {
        throw new BadRequestError({
            message: "Access token is required to verify",
            code: "ACCESS_TOKEN_REQUIRED",
        });
    }

    const normalizedToken = token.trim();

    return jwt.verify(normalizedToken, config.jwtAccessSecret);
}

export {
    generateAccessToken,
    verifyAccessToken
}
