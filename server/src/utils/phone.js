import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Parses and normalizes a raw phone number string, with a retry for the
 * common Ghanaian typo of a redundant leading 0 after the country code
 * (e.g. "+2330244..." → "+233244...").
 * @param {string} value - Raw phone number input.
 * @param {string} [defaultCountry="GH"] - ISO country code to assume when the input has no explicit country code.
 * @returns {{input: string, country: string, countryCallingCode: string, national: string, e164: string, international: string, nationalFormatted: string, type: string|null, isValid: true}|null}
 *   Normalized phone details, or null if the input isn't a valid phone number.
 */
const normalizePhoneNumber = (
    value,
    defaultCountry = "GH"
) => {
    if(typeof value !== "string"){
        return null
    }

    let raw = value.trim();

    if(!raw){
        return null;
    }

    if(raw.length > 50){
        raw = raw.slice(0, 50);
    }

    raw = raw.replace(/[()\s-]/g, "");

    let phoneNumber;

    try {
        phoneNumber = parsePhoneNumberFromString(
            raw,
            defaultCountry
        );
    } catch {
        phoneNumber = undefined;
    }

    if (
        (!phoneNumber || !phoneNumber.isValid()) &&
        /^\+2330\d+$/.test(raw)
    ) {
        const retry = raw.replace(/^\+2330/, "+233");

        try {
            phoneNumber = parsePhoneNumberFromString(retry);
        } catch {
            phoneNumber = undefined;
        }
    }

    if (!phoneNumber || !phoneNumber.isValid()) {
        return null;
    }

    return {
        input: raw,
        country: phoneNumber.country || defaultCountry,
        countryCallingCode: `+${phoneNumber.countryCallingCode}`,
        national: phoneNumber.nationalNumber,
        e164: phoneNumber.number,
        international:
            phoneNumber.formatInternational(),
        nationalFormatted:
            phoneNumber.formatNational(),
        type: phoneNumber.getType?.() || null,
        isValid: true,
    };
}

export {
    normalizePhoneNumber
}