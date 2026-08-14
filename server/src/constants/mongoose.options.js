/**
 * Connection options passed to mongoose.connect().
 */
const OPTIONS = Object.freeze({
    socketTimeoutMS: 45000,     
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 50,
    minPoolSize: 5,
})

export {
    OPTIONS
}
