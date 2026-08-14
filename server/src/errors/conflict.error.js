import { AppError } from "./app.error.js";
import { HTTP_STATUS } from "../constants/index.js";

/** Thrown when a request conflicts with the current state of a resource (HTTP 409). */
class ConflictError extends AppError{
    /**
     * @param {object} [options]
     * @param {string} [options.message="Conflict error"]
     * @param {string} [options.code] - Machine-readable error code.
     */
    constructor({
        message = "Conflict error",
        code
    } = {}){
        super({
            message,
            statusCode: HTTP_STATUS.CONFLICT,
            code,
        })
    }
}
export {
    ConflictError,
}