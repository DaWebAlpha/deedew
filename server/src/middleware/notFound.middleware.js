import { HTTP_STATUS } from "../constants/index.js"

/**
 * Catch-all for requests that didn't match any route. Must be registered
 * after all real routes and before the error handler.
 * @param {import("express").Request} request
 * @param {import("express").Response} response
 * @param {import("express").NextFunction} next
 * @returns {import("express").Response}
 */
const notFound = (request, response, next) => {
    return response.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        message: `The requested resource ${request.originalUrl} could not be found`
    })
}

export { notFound };