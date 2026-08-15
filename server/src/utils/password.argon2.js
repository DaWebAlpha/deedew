import argon2 from "argon2";
import { ARGON_CONFIG } from "../constants/index.js";

import { BadRequestError, AppError } from "../errors/index.js";
import { systemLogger } from "../logger/pino.logger.js";

/**
 * Hashes a plaintext password with Argon2id, using the app's ARGON_CONFIG.
 * @param {string} password - The plaintext password to hash.
 * @returns {Promise<string>} The Argon2 hash string.
 * @throws {BadRequestError} If password isn't a non-empty string.
 * @throws {AppError} If hashing itself fails (e.g. Argon2 native error).
 */
const hashPassword = async(password) => {
    if(typeof password !== "string"){
        throw new BadRequestError({
            message: "Invalid password input",
            code: "INVALID_PASSWORD_TYPE"
        })
    }

    if(password.trim().length === 0){
        throw new BadRequestError({
            message: "Invalid password input",
            code: "EMPTY_PASSWORD",
        })
    }

    try{
        return await argon2.hash(password, ARGON_CONFIG);
    }catch(error){
        systemLogger.error({ err: error }, "Password hashing failed");

        throw new AppError({
            message: "Internal security error.",
            code: "PASSWORD_HASH_FAILURE",
        });
    }
}

/**
 * Verifies a plaintext password against an Argon2 hash. Never throws —
 * any malformed input or verification error resolves to false.
 * @param {string} plainPassword - The plaintext password to check.
 * @param {string} hashedPassword - The stored Argon2 hash to check against.
 * @returns {Promise<boolean>} True if the password matches the hash.
 */
const verifyPassword = async (plainPassword, hashedPassword) => {
    if (
        typeof plainPassword !== "string" ||
        typeof hashedPassword !== "string"
    ) {
        return false;
    }

    try {
        return await argon2.verify(
            hashedPassword,
            plainPassword
        );
    } catch (error) {
        systemLogger.error({ err: error }, "Password verification failed");

        return false;
    }
};

export {
    hashPassword,
    verifyPassword,
};