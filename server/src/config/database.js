import mongoose from "mongoose";
import { config } from "./index.js";
import { OPTIONS } from "../constants/index.js";
import { systemLogger } from "../logger/pino.logger.js";

/**
 * Opens the MongoDB connection using the configured URI and connection options.
 * @returns {Promise<void>}
 */
const connectDatabase = async() => {
    await mongoose.connect(config.mongoUri, OPTIONS);

}

mongoose.connection.on("connected", () => {
    systemLogger.info("MongoDB connection established");
})

mongoose.connection.on("error", (error) => {
    systemLogger.error({ err: error }, "MongoDB connection error");
})

export { connectDatabase };