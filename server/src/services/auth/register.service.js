import {
    BadRequestError,
    ConflictError
 } from "../../errors/index.js";

 import {
    withTransaction,
    normalizeEmail,
    normalizeString,
    normalizeCountry,
    normalizePhoneNumber,
    generateAccessToken,
    generateRefreshToken,
    throwErrorOnEmptyInput,
 } from "../../utils/index.js";

 import {
    User,
    UserSecurity,
    LoginLog
} from "../../models/index.js";

import {
    auditLogger
} from "../../logger/pino.logger.js";


const resolveId = (doc) => doc?._id ?? doc?.id ?? null;

/**
 * Creates a new User, its UserSecurity record, and an initial session
 * (access + refresh token) inside one transaction.
 * @param {object} params
 * @param {string} params.firstName
 * @param {string} params.lastName
 * @param {string} params.email
 * @param {string} params.phoneNumber
 * @param {string} [params.country] - ISO country code; defaults to "GH" if not supplied.
 * @param {string} params.password
 * @param {string} [params.deviceName]
 * @param {string} [params.deviceId]
 * @param {string} [params.userAgent]
 * @param {string} [params.ipAddress]
 * @returns {Promise<{user: import("mongoose").Document, security: import("mongoose").Document, accessToken: string, refreshToken: string, message: string}>}
 * @throws {BadRequestError} If a required field is empty or user creation fails validation.
 * @throws {ConflictError} If the email or phone number is already registered.
 */
const registerUserService = async ({
    firstName,
    lastName,
    email,
    phoneNumber,
    country,
    password,
    deviceName = null,
    deviceId = null,
    userAgent = null,
    ipAddress = null,
} = {}) => {
    throwErrorOnEmptyInput(firstName, "First name");
    throwErrorOnEmptyInput(lastName, "Last name");
    throwErrorOnEmptyInput(email, "Email");
    throwErrorOnEmptyInput(phoneNumber, "Phone number");
    throwErrorOnEmptyInput(password, "Password");


    const normalizedCountry = normalizeCountry(country) || "GH";
    const phoneDetails = normalizePhoneNumber(
        normalizeString(phoneNumber),
        normalizedCountry,
    );
    const normalizedPhoneNumber = phoneDetails?.e164 ?? null;
    const normalizedEmail = normalizeEmail(email);


    const [emailExists, phoneNumberExists] = await Promise.all([
        User.exists({email: normalizedEmail}),
        User.exists({phoneNumber: normalizedPhoneNumber}),
    ])

    if(emailExists){
        throw new ConflictError({
            message: "Email already exists",
            code: "EMAIL_EXISTS",
        })
    }

    if(phoneNumberExists){
        throw new ConflictError({
            message: "Phone number already exists",
            code: "PHONE_NUMBER_EXISTS"
        })
    }

    return withTransaction(async (session) => {
        let user;

        try{
            [user] = await User.create(
                [{
                    firstName,
                    lastName,
                    email,
                    country,
                    phoneNumber,
                    password
                }],
                {session}
            )


        }catch(error){
            if (error.code === 11000) {
                const field = Object.keys(error.keyPattern ?? {})[0] ?? "field";
                throw new ConflictError({ message: `${field} already exists` });
            }
            if (error.name === "ValidationError") {
                const messages = Object.values(error.errors).map((e) => e.message);
                throw new BadRequestError({ message: messages.join("<br />") });
            }
            throw error;
        }

        const userId = resolveId(user);

        if (!userId) {
            throw new BadRequestError({
                message: "User creation failed: missing user id",
            });
        }

        const security = await UserSecurity.findOrCreateForUser(userId, {session});

        const accessToken = await generateAccessToken(userId.toString());

        const refreshToken = await generateRefreshToken({
            userId,
            deviceName,
            deviceId,
            userAgent,
            ipAddress,
            session,
        });

        auditLogger.info(
            { userId, deviceId },
            "User registered",
        );

        await LoginLog.create(
            [{
                userId,
                identifier: email,
                success: true,
                deviceName,
                deviceId,
                userAgent,
                ipAddress,
            }],
            { session }
        );
        return {
            user,
            security,
            accessToken,
            refreshToken,
            message: "User registered successfully",
        };
    })
}

export {
    registerUserService
}
