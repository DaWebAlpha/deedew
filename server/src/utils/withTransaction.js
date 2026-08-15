import mongoose from "mongoose";

const MAX_TRANSACTION_ATTEMPTS = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Detects MongoDB's TransientTransactionError label — the documented,
 * expected error MongoDB returns when two transactions touch the same
 * document at (almost) the same time. This is not a bug or a real
 * failure; it's MongoDB's way of saying "retry me."
 * @param {*} error - The caught error to inspect.
 * @returns {boolean} True if this error is safe to retry.
 */
const isTransientTransactionError = (error) => {
    if (typeof error?.hasErrorLabel === "function") {
        return error.hasErrorLabel("TransientTransactionError");
    }

    return Boolean(error?.errorLabels?.includes?.("TransientTransactionError"));
};

/**
 * Runs `callback(session)` inside a transaction, retrying on
 * MongoDB's TransientTransactionError (the documented, expected
 * error when two transactions touch the same document at once) with
 * linear backoff. Centralized specifically because refreshTokenService
 * hand-rolled this exact logic once already and got the error check
 * wrong the first time (`error.errorLabels.includes(...)` instead of
 * the real `error.hasErrorLabel(...)` method) — Order/Payment will
 * need the same retry-safe transaction pattern and shouldn't have to
 * rediscover that mistake independently.
 *
 * The callback is re-run from scratch on each retry, not just the
 * write — any reads it does should be re-read fresh too, so a losing
 * attempt correctly sees the winner's committed state instead of
 * acting on stale data.
 * @param {(session: import("mongoose").ClientSession) => Promise<*>} callback - Receives the active session; do every read/write for this unit of work through it.
 * @param {object} [options]
 * @param {number} [options.maxAttempts=3] - How many times to retry a transient failure before giving up.
 * @returns {Promise<*>} Whatever `callback` returns, once the transaction commits.
 * @throws {*} Re-throws the callback's error immediately if it isn't a transient one, or after maxAttempts is exhausted.
 */
const withTransaction = async (callback, { maxAttempts = MAX_TRANSACTION_ATTEMPTS } = {}) => {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            const result = await callback(session);

            await session.commitTransaction();

            return result;
        } catch (error) {
            await session.abortTransaction();

            if (isTransientTransactionError(error) && attempt < maxAttempts) {
                await wait(50 * attempt);
                continue;
            }

            throw error;
        } finally {
            session.endSession();
        }
    }
};

export { withTransaction, isTransientTransactionError };
