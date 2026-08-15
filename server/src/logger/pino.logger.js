import pino from "pino";
import path from "node:path";
import fs from "node:fs";
import { config } from "../config/index.js";

const isDevelopment = config.nodeEnv === "development";
const logLevel = isDevelopment ? "debug" : "info";

const logDirectory = path.resolve(config.logDirectory);

if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
}

/**
 * Builds a single pino-roll file transport target.
 * @param {string} fileLocation - Path (relative to logDirectory) for the rolled log file.
 * @param {string} frequency - Roll frequency, e.g. "daily".
 * @param {string} fileSize - Max file size before rolling, e.g. "20m".
 * @param {string} [minLevel="info"] - Minimum pino level written to this target.
 * @param {number} retentionCount - How many rolled files to retain.
 * @returns {object} A pino.transport target descriptor.
 */
const buildTransportTarget = (
    fileLocation,
    frequency,
    fileSize,
    minLevel = "info",
    retentionCount
) => ({
    target: "pino-roll",
    level: minLevel,
    options: {
        file: path.join(logDirectory, fileLocation),
        extension: ".json",
        frequency,
        size: fileSize,
        mkdir: true,
        dateFormat: "yyyy-MM-dd",
        sync: false,
        limit: {
            count: retentionCount,
        },
    },
});

const terminalTargets = isDevelopment
    ? [
          {
              target: "pino-pretty",
              options: {
                  colorize: true,
                  ignore: "pid,hostname",
                  translateTime: "SYS:yyyy-MM-dd HH:mm:ss",
              },
          },
      ]
    : [];

const systemTransport = pino.transport({
    targets: [
        buildTransportTarget("system/app-info", "daily", "20m", "info", 90),
        buildTransportTarget("system/app-error", "daily", "20m", "error", 90),
        ...terminalTargets,
    ],
});

const auditTransport = pino.transport({
    targets: [
        buildTransportTarget("audit/app-audit", "daily", "20m", "info", 180),
        ...terminalTargets,
    ],
});

const accessTransport = pino.transport({
    targets: [
        buildTransportTarget("access/app-access", "daily", "20m", "info", 180),
        ...terminalTargets,
    ],
});

/**
 * Base pino options shared by all three loggers: level, ISO timestamps,
 * a fixed service/environment base object, sensitive-field redaction,
 * and a level_label mixin for readable log level names.
 * @returns {object}
 */
const getBaseConfig = () => ({
    level: logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,

    base: {
        service: "superdeedew-api",
        environment: config.nodeEnv,
    },

    redact: {
        paths: [
            "password",
            "*.password",
            "token",
            "*.token",
            "access_token",
            "refresh_token",
            "*.access_token",
            "*.refresh_token",
            "accessToken",
            "*.accessToken",
            "refreshToken",
            "*.refreshToken",
            "apiKey",
            "*.apiKey",
            "authorization",
            "*.authorization",
            "headers.authorization",
            "*.headers.authorization",
            "cookie",
            "*.cookie",
            "headers.cookie",
            "*.headers.cookie",
            "req.headers.authorization",
            "req.headers.cookie",
        ],
        remove: true,
    },

    mixin(_context, levelNumber) {
        const labels = {
            10: "trace",
            20: "debug",
            30: "info",
            40: "warn",
            50: "error",
            60: "fatal",
        };

        return {
            level_label: labels[levelNumber] || "info",
        };
    },
});

/** General application logs (info/error), split into daily rolled files. */
export const systemLogger = pino(getBaseConfig(), systemTransport);
/** Audit trail logs, kept longer than system logs (180 vs 90 days). */
export const auditLogger = pino(getBaseConfig(), auditTransport);
/** HTTP access logs. */
export const accessLogger = pino(getBaseConfig(), accessTransport);

/** Convenience bundle of all three loggers. */
export const loggers = {
    systemLogger,
    auditLogger,
    accessLogger,
};
