/**
 * Wraps an async Express route handler so a rejected promise is forwarded
 * to next(error) instead of becoming an unhandled rejection.
 * @param {(request: import("express").Request, response: import("express").Response, next: import("express").NextFunction) => Promise<unknown>} fn
 * @returns {(request: import("express").Request, response: import("express").Response, next: import("express").NextFunction) => Promise<unknown>}
 */
const asyncHandler = (fn) => (request, response, next) => {
    return Promise.resolve(fn(request, response, next)).catch(next);
}

export {
    asyncHandler,
};