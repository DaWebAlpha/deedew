import { config } from "../config/index.js";

const isProduction = config.nodeEnv === "production";
const ACCESS_TOKEN_COOKIE = config.accessTokenCookie;
const REFRESH_TOKEN_COOKIE = config.refreshTokenCookie;


/**
 * Sets the access and refresh tokens as httpOnly cookies on the response.
 * Both cookies are httpOnly (unreadable by client-side JS, so an XSS
 * payload can't steal them) and secure in production (HTTPS only); each
 * cookie's maxAge is derived from the same expiry config used to sign/
 * generate the token it holds, so the cookie never outlives the token.
 * @param {import("express").Response} response - The Express response to set cookies on.
 * @param {object} tokens
 * @param {string} tokens.accessToken - Signed JWT access token.
 * @param {string} tokens.refreshToken - Opaque refresh token string.
 * @returns {void}
 */
const setAuthCookies = (response, { accessToken, refreshToken }) => {
    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: config.jwtAccessExpirySeconds * 1000,
    });

    response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: config.jwtRefreshExpiryDays * 24 * 60 * 60 * 1000,
    });
};

/**
 * Clears the access and refresh token cookies, e.g. on logout — the
 * browser is told to delete them immediately (Express sets an already-
 * expired Expires date under the hood).
 * @param {import("express").Response} response - The Express response to clear cookies on.
 * @returns {void}
 */
const clearAuthCookies = (response) => {
    response.clearCookie(ACCESS_TOKEN_COOKIE);
    response.clearCookie(REFRESH_TOKEN_COOKIE);
};

export {
    setAuthCookies,
    clearAuthCookies,
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE
};
