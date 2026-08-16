import { BadRequestError } from "../errors/index.js";


/**
 * Throws a BadRequestError named after `fieldName` if `value` is falsy.
 * @param {*} value - The value to check.
 * @param {string} fieldName - Human-readable field name, used to build both the message and code.
 * @returns {void}
 * @throws {BadRequestError} If value is falsy.
 */
const throwErrorOnEmptyInput = (value, fieldName) => {
    if (!value) {
        throw new BadRequestError({
            message: `${fieldName} is required`,
            code: `${fieldName.toUpperCase().replace(/\s+/g, "_")}_REQUIRED`,
        });
    }
};


export {
    throwErrorOnEmptyInput
}
