/**
 * Trims a string, or returns "" for non-string input.
 * @param {*} value
 * @returns {string}
 */
const normalizeString = (value) => {
    return typeof value === "string" ?
            value.trim() :
            ""
}

/**
 * Trims and lowercases a string for consistent email storage/comparison,
 * or returns "" for non-string input.
 * @param {*} value
 * @returns {string}
 */
const normalizeEmail = (value) => {
    return typeof value === "string" ?
            value.trim().toLowerCase() :
            "";
}


/**
 * Trims and uppercases a string for consistent country-code storage,
 * or returns "" for non-string input.
 * @param {*} value
 * @returns {string}
 */
const normalizeCountry = (value) => {
    return typeof value === "string" ?
            value.trim().toUpperCase() :
            ""
}

/**
 * Trims a string and collapses internal runs of whitespace to a single
 * space, or returns "" for non-string input.
 * @param {*} value
 * @returns {string}
 */
const normalizeText = (value) => {
    return typeof value === "string" ?
    value.trim().replace(/\s+/g, " ") :
    "";
}


export {
    normalizeString,
    normalizeEmail,
    normalizeCountry,
    normalizeText
}