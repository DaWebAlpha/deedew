import rateLimit from "express-rate-limit";
import { HTTP_STATUS } from "../constants/index.js";

/**
 * Caps /register and /login to 20 requests per 15 minutes, per IP.
 * @type {import("express").RequestHandler}
 */
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    message: {
        success: false,
        message: "Too many attempts. Please try again later.",
        code: "RATE_LIMITED",
    },
});

export { authRateLimiter };
