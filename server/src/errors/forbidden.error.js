import { AppError } from "./app.error.js";
import { HTTP_STATUS } from "../constants/index.js";


/**
 * Thrown when the client is authenticated but lacks permission for the action (HTTP 403).
 */
class ForbiddenError extends AppError{
    /**
     * @param {object} [options]
     * @param {string} [options.message="Forbidden error"]
     * @param {string} [options.code] - Machine-readable error code.
     */
    constructor({
        message = "Forbidden error",
        code
    } = {}){
        super({
            message,
            statusCode: HTTP_STATUS.FORBIDDEN,
            code
        })
    }
}

export { 
    ForbiddenError
}

