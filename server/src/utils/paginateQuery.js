const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_LIMIT = 100;

/**
 * Plain find/skip/limit pagination for models that don't go through
 * createSchema() (e.g. LoginLog), so they don't get the shared
 * .paginate() static and its isDeleted-aware default filter — which
 * would silently match nothing on a model with no isDeleted field.
 * @param {object} options
 * @param {import("mongoose").Model} options.model - The Mongoose model to query.
 * @param {object} [options.filter={}] - Query conditions, passed straight to `.find()`.
 * @param {number} [options.page=1] - 1-indexed page number.
 * @param {number} [options.limit=50] - Page size, clamped to DEFAULT_MAX_LIMIT (100).
 * @param {object} [options.sort={createdAt: -1}] - Sort order, newest first by default.
 * @returns {Promise<{data: object[], page: number, limit: number, total: number, totalPages: number, hasNextPage: boolean, hasPreviousPage: boolean}>}
 */
const paginateQuery = async ({
    model,
    filter = {},
    page = 1,
    limit = DEFAULT_PAGE_SIZE,
    sort = { createdAt: -1 },
} = {}) => {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(Math.max(1, Number(limit) || DEFAULT_PAGE_SIZE), DEFAULT_MAX_LIMIT);
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
        model.find(filter).sort(sort).skip(skip).limit(safeLimit),
        model.countDocuments(filter),
    ]);

    return {
        data,
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
        hasNextPage: safePage * safeLimit < total,
        hasPreviousPage: safePage > 1,
    };
};

export { paginateQuery };
