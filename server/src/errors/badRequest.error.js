import { AppError } from "./app.error.js";
import { HTTP_STATUS } from "../constants/index.js";

/** Thrown when a request is malformed or fails validation (HTTP 400). */
class BadRequestError extends AppError{
    /**
     * @param {object} [options]
     * @param {string} [options.message="Bad request error"]
     * @param {string} [options.code] - Machine-readable error code.
     */
    constructor({
        message= "Bad request error",
        code
    } = {}){
        super({
            message,
            statusCode: HTTP_STATUS.BAD_REQUEST,
            code
        })
    }
}

export {
    BadRequestError
}