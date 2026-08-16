/** Shared enums for product listings and payments. */
const PRODUCT_TYPE = Object.freeze({
    RAW_PRODUCE: "raw_produce",
    COOKED_FOOD: "cooked_food",
    PACKAGED_GOOD: "packaged_good",
});

const CURRENCY = Object.freeze({
    GHS: "GHS",
    USD: "USD",
});

const MEASUREMENTS = Object.freeze({
    PACK: "pack",
    KG: "kg",
    BAG: "bag",
    PIECE: "piece",
    LITRE: "litre",
});

const QUALITY_GRADES = Object.freeze({
    GRADE_A: "grade_a",
    GRADE_B: "grade_b",
    GRADE_C: "grade_c",
});

export {
    PRODUCT_TYPE,
    CURRENCY,
    MEASUREMENTS,
    QUALITY_GRADES
};
