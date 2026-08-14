import dotenv from "dotenv";

dotenv.config();

const { 
    PORT,
    MONGO_URI,
} = process.env;

const requiredEnvVars = {
    MONGO_URI,

}

for(const [key,value] of Object.entries(requiredEnvVars)){
    if(!value || typeof value !== "string" || value.trim() === ""){
        throw new Error(`Missing required .env: ${key}`)
    }
}

/**
 * Coerces an env var string into a positive finite number, falling back
 * to a default when the value is missing or not a valid positive number.
 * @param {string|undefined} value - Raw environment variable value.
 * @param {number} fallback - Default to use when value is invalid/absent.
 * @returns {number}
 */
const toNumber = (value, fallback) => {
    if(!value){
        return fallback
    }

    const parsed = Number(value);

    return !Number.isNaN(parsed) &&
            Number.isFinite(parsed) &&
            parsed > 0 ?
            parsed :
            fallback;
}

/** Frozen application configuration, sourced from environment variables. */
const config = Object.freeze({
    port: toNumber(PORT, 5700),
    mongoUri: MONGO_URI,
})

export {
    config
}