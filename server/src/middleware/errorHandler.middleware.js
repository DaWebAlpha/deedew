import { HTTP_STATUS } from "../constants/index.js";
import { systemLogger } from "../logger/pino.logger.js";

/**
 * Global Express error handler. Must be registered last, after all routes
 * and other middleware, so both thrown and next(error)-forwarded errors land here.
 * Operational errors (instances of AppError) expose their own message/code;
 * anything else is treated as unexpected and masked with a generic message.
 * @param {Error|import("../errors/app.error.js").AppError} error - The error passed via next(error) or thrown.
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {import("express").NextFunction} next
 * @returns {import("express").Response}
 */
const errorHandler = (error, request, response, next) => {

    const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const code = error.code;
    const isOperational = error.isOperational || false;

    systemLogger.error({ err: error }, "Request failed");

    return response.status(statusCode).json({
        success: false,
        message: isOperational ? error.message : "Something went wrong",
        code: isOperational ? code : "INTERNAL_SERVER_ERROR",
    })

    
}

export { errorHandler };
