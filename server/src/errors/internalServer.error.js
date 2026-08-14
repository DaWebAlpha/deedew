import { AppError } from "./app.error.js";
import { HTTP_STATUS } from "../constants/index.js";

/** Thrown for unexpected server-side failures (HTTP 500). */
class InternalServerError extends AppError{
    /**
     * @param {object} [options]
     * @param {string} [options.message="Internal server error"]
     * @param {string} [options.code] - Machine-readable error code.
     */
    constructor({
        message = "Internal server error",
        code
    } = {}){
        super({
            message,
            statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
            code
        })
    }
}

export {
    InternalServerError
}