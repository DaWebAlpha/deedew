/**
 * Field names to strip/mask before logging or returning documents to clients.
 */
const SENSITIVE_FIELDS = Object.freeze([
    "password",
    "accessToken",
    "refreshToken",
    "token",
    "otp",
    "pin",
    "secret",
    "apiKey",
    "clientSecret",
    "cardNumber",
    "cvv",
    "bankAccountNumber",
    "tokenHash",
    "rawToken",
])

export {
    SENSITIVE_FIELDS,
}