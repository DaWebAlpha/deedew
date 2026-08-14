import mongoose from "mongoose";
import { config } from "./index.js";
import { OPTIONS } from "../constants/index.js";

/** Opens the MongoDB connection using the configured URI and connection options. */
const connectDatabase = async() => {
    await mongoose.connect(config.mongoUri, OPTIONS);

}

mongoose.connection.on("connected", () => {
    console.log("MongoDB connection established");
})

mongoose.connection.on("error", (error) => {
    console.error({err: error.message}, "MongoDB connection error")
})

export { connectDatabase };