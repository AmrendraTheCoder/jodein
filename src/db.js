/**
 * @file db.js
 * @description Backward-compatible wrapper for Mongoose singleton connection.
 * Re-exports connectivity routines from the new `src/config/db.js` configuration module.
 */

import mongoose, { connectDB, isDBConnected } from './config/db.js'

export { connectDB, isDBConnected }
export default mongoose
