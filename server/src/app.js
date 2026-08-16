import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import {
    notFound,
    errorHandler
} from "./middleware/index.js";
import {
    authRouter,
    adminUsersRouter,
    adminLoginLogsRouter,
    adminSessionsRouter,
    adminSecurityRouter,
    adminPingsRouter,
    categoryRouter,
    productRouter,
    sellerRouter,
} from "./routes/index.js";
import { config } from "./config/index.js";



const app = express();

const allowedOrigins = config.frontendUrl.split(",").map((url) => url.trim());

app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));
app.use(cookieParser());

// express.json() only sets request.body when the request actually has a
// JSON body — a POST/DELETE sent with no body at all (not even "{}")
// leaves request.body as undefined, and every controller that reads an
// optional field off it (e.g. request.body.reason) would otherwise crash
// with "Cannot read properties of undefined" instead of just treating
// the missing field as absent.
app.use((request, response, next) => {
    if (request.body === undefined) {
        request.body = {};
    }
    next();
});

app.use("/api", authRouter);
app.use("/api/admin/users", adminUsersRouter);
app.use("/api/admin/login-logs", adminLoginLogsRouter);
app.use("/api/admin/sessions", adminSessionsRouter);
app.use("/api/admin/security", adminSecurityRouter);
app.use("/api/admin/pings", adminPingsRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/products", productRouter);
app.use("/api/sellers", sellerRouter);

// Must be registered last: catches unmatched routes, then any error passed via next()/thrown.
app.use(notFound);
app.use(errorHandler);

export { app };
