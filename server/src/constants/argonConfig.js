import argon2 from "argon2";

/**
 * Argon2id hashing parameters used by hashPassword.
 */
const ARGON_CONFIG = Object.freeze({
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
})

export {
    ARGON_CONFIG
}

