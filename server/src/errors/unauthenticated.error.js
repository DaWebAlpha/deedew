import { AppError } from "./app.error.js";
import { HTTP_STATUS } from "../constants/index.js";


/**
 * Thrown when a request lacks valid authentication credentials (HTTP 401).
 */
class UnauthenticatedError extends AppError{
    /**
     * @param {object} [options]
     * @param {string} [options.message="Unauthenticated error"]
     * @param {string} [options.code] - Machine-readable error code.
     */
    constructor({
        message = "Unauthenticated error",
        code
    } = {}){
        super({
            message,
            statusCode: HTTP_STATUS.UNAUTHENTICATED,
            code
        })
    }
}

export {
    UnauthenticatedError
}