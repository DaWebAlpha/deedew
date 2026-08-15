import { AppError } from "./app.error.js";
import { HTTP_STATUS } from "../constants/index.js";

/**
 * Thrown when a requested resource does not exist (HTTP 404).
 */
class NotFoundError extends AppError{
    /**
     * @param {object} [options]
     * @param {string} [options.message="Resource not found"]
     * @param {string} [options.code] - Machine-readable error code.
     */
    constructor({
        message= "Resource not found",
        code,
    } = {}){
        super({
            message,
            statusCode: HTTP_STATUS.NOT_FOUND,
            code
        })
    }
}

export {
    NotFoundError
}