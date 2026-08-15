import crypto from "node:crypto";

/**
 * Length of the appended uniqueness suffix: a hyphen plus 8 hex characters.
 */
const SLUG_SUFFIX_LENGTH = 9;

/**
 * Turns a human-readable name into a URL-safe slug, with a short random
 * suffix appended so two categories with the same (or similarly-typed)
 * name never collide on slug alone. e.g. "Fresh Produce" -> "fresh-produce-a1b2c3d4".
 * @param {string} value - The name to slugify.
 * @returns {string}
 */
const generateSlug = (value) => {
    const base = String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    const suffix = crypto.randomBytes(4).toString("hex");

    return `${base}-${suffix}`;
};

export { generateSlug, SLUG_SUFFIX_LENGTH };
