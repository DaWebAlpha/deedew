/**
 * Builds a MongoDB filter combining exact-match conditions with a
 * case-insensitive text search across a given list of fields. Shared by
 * every admin list service that supports search/filtering — not tied to
 * any one model's field names, so the same helper works for User
 * (search firstName/lastName/email, exact-match role), Category (search
 * categoryName/description, no exact-match fields), or any future model.
 * @param {object} [options]
 * @param {string[]} [options.fields=[]] - Field names to match `search` against (combined with $or).
 * @param {string} [options.search] - Free-text search term.
 * @param {object} [options.exact={}] - Exact-match conditions, e.g. `{ role: "admin" }`. Only keys with a truthy value are included.
 * @returns {object} A MongoDB filter object.
 */
const buildSearchFilter = ({ fields = [], search, exact = {} } = {}) => {
    const filter = {};

    for (const [key, value] of Object.entries(exact)) {
        if (value) {
            filter[key] = value;
        }
    }

    if (search && fields.length) {
        const pattern = new RegExp(search.trim(), "i");
        filter.$or = fields.map((field) => ({ [field]: pattern }));
    }

    return filter;
};

export { buildSearchFilter };
