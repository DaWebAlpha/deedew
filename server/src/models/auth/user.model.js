import mongoose from "mongoose";
import { createSchema } from "../base/index.js";

import {
    normalizeString,
    normalizeEmail,
    normalizeCountry,
    normalizePhoneNumber,
    hashPassword,
    verifyPassword
} from "../../utils/index.js";

import {
    AppError,
    BadRequestError,
    InternalServerError,
} from "../../errors/index.js";

import { systemLogger } from "../../logger/pino.logger.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

/** Every registered account — customer, admin, and superadmin all share this one model, distinguished by `role`. */
const userSchemaDefinition = {
    firstName: {
        type: String,
        trim: true,
        required: [true, "First name is required"],
        maxlength: [50, "First name is too long"],
    },
    lastName: {
        type: String,
        trim: true,
        required: [true, "Last name is required"],
        maxlength: [50, "Last name is too long"]
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: (value) => EMAIL_REGEX.test(value),
            message: "Enter a valid email address",
        }
    },
    phoneNumber: {
        type: String,
        trim: true,
        required: [true, "Phone number is required"],
        validate: {
            validator(value){
                return normalizePhoneNumber(value, normalizeCountry(this.country) || "GH") !== null;
            },
            message: "Enter a valid phone number",
        }
    },
    country: {
        type: String,
        default: "GH"
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [8, "Password must be atleast 8 characters"],
        select: false,
    },
    isSeller: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        enum: ["customer", "admin", "superadmin"],
        default: "customer"
    },
}

const userSchema = createSchema(userSchemaDefinition);

userSchema.index({email: 1, role: 1});
userSchema.index({phoneNumber: 1, role: 1});
userSchema.index({isSeller: -1});

// Re-hashes the password only when it actually changed, so unrelated
// edits (e.g. firstName) never re-hash an already-hashed value.
userSchema.pre("save", async function(){
    if(!this.isModified("password")){
        return;
    }

    this.password = await hashPassword(this.password);
})

/** Verifies a plaintext password against this document's stored hash. */
userSchema.methods.comparePassword = async function(plainPassword){
    if(typeof plainPassword !== "string"){
        return false;
    }

    if(!this.password){
        systemLogger.error(
            { userId: this._id },
            "Password field not selected in query.",
        );

        throw new InternalServerError({
            message: "Internal authentication error.",
            code: "PASSWORD_NOT_SELECTED",
        });
    }

    try{
        return await verifyPassword(
            plainPassword,
            this.password
        )
    }catch(error){
        if (error instanceof AppError) {
            throw error;
        }

        systemLogger.error({ err: error }, "Password comparison failed.");

        throw new InternalServerError({
            message: "Internal authentication error.",
            code: "PASSWORD_VERIFICATION_FAILED",
        });
    }
}

// Normalizes text fields and converts phoneNumber to E.164 on save.
userSchema.pre("save", async function(){
    if(this.isModified("firstName") && this.firstName){
        this.firstName = normalizeString(this.firstName);
    }

     if(this.isModified("lastName") && this.lastName){
        this.lastName = normalizeString(this.lastName);
    }

     if(this.isModified("email") && this.email){
        this.email = normalizeEmail(this.email);
    }

    if(this.isModified("country") && this.country){
        this.country = normalizeCountry(this.country);
    }

    if (
        (
            this.isModified("phoneNumber") ||
            this.isModified("country")
        ) &&
        this.phoneNumber
    ) {
        if (!E164_REGEX.test(this.phoneNumber)) {
            const normalizedPhoneNumber = normalizePhoneNumber(
                normalizeString(
                    this.phoneNumber,
                ),
                this.country || "GH",
            );

            if (!normalizedPhoneNumber) {
                throw new BadRequestError({
                    message: "Enter a valid phone number",
                    code: "INVALID_PHONE_NUMBER",
                });
            }

            this.phoneNumber = normalizedPhoneNumber.e164;
        }
    }
})

const User = mongoose.model("User", userSchema);

export {
    User
}
