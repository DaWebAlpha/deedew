/**
 * Loads and validates environment variables, then exposes them as one
 * frozen `config` object. This is the only file allowed to read
 * process.env directly — everything else imports `config` from here.
 */
import dotenv from "dotenv";

dotenv.config();

const {
    PORT,
    MONGO_URI,
    FRONTEND_URL,
    NODE_ENV,
    LOG_DIRECTORY,
    JWT_ACCESS_EXPIRY_SECONDS,
    JWT_ACCESS_SECRET,
    JWT_REFRESH_EXPIRY_DAYS,
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
} = process.env;

const requiredEnvVars = [
    "MONGO_URI",
    "FRONTEND_URL",
    "JWT_ACCESS_SECRET",
];

for(const key of requiredEnvVars){
    if(!process.env[key]){
        throw new Error(`Missing required env: ${key}`)
    }
}

const toNumber = (value, fallback) => {
    if(!value){
        return fallback
    }

    const validNumber = Number(value);

    return Number.isFinite(validNumber) &&
           validNumber > 0 ?
           validNumber : fallback;

}
const allowedNodeEnvs = ["development", "test", "production"];
const resolvedNodeEnv = allowedNodeEnvs.includes(NODE_ENV) ?
                        NODE_ENV :
                        "development";


const config = Object.freeze({
    mongoUri: MONGO_URI,
    port: toNumber(PORT, 5700),
    frontendUrl: FRONTEND_URL,
    logDirectory: LOG_DIRECTORY || "logs",
    nodeEnv: resolvedNodeEnv,
    jwtAccessExpirySeconds: toNumber(JWT_ACCESS_EXPIRY_SECONDS, 900),
    jwtAccessSecret: JWT_ACCESS_SECRET,
    jwtRefreshExpiryDays: toNumber(JWT_REFRESH_EXPIRY_DAYS, 30),
    accessTokenCookie: ACCESS_TOKEN_COOKIE || "accessToken",
    refreshTokenCookie: REFRESH_TOKEN_COOKIE || "refreshToken",
})

export { config };