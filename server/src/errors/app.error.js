import { HTTP_STATUS } from "../constants/index.js";

/**
 * Base class for all operational (expected/handled) application errors.
 * Domain-specific errors (NotFoundError, BadRequestError, etc.) should
 * extend this class rather than the native Error, so that a global error
 * handler can rely on `statusCode`, `code`, and `isOperational` being present.
 */
class AppError extends Error{
    /**
     * @param {object} options
     * @param {string} options.message - Human-readable error message.
     * @param {number} [options.statusCode=HTTP_STATUS.INTERNAL_SERVER_ERROR] - HTTP status code to respond with.
     * @param {string} [options.code] - Machine-readable error code for clients/logging.
     */
    constructor({
        message,
        statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
        code,
    } = {}){
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        // Marks this as an expected error so the global handler can
        // distinguish it from unexpected/programmer errors.
        this.isOperational = true;

        if(Error.captureStackTrace){
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export {
    AppError
}