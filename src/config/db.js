/**
 * @file db.js
 * @description Establishes a highly resilient, monitored MongoDB connection pool using Mongoose.
 * Features automated event logging, connection pool management, heartbeat tracking, and aggressive timeout strategies.
 * It also overrides Node's default DNS servers to Google's public DNS to avoid DNS SRV resolution issues on standard ISP setups.
 */

import mongoose from 'mongoose'
import dns from 'dns'
import { config } from 'dotenv'

// Load environment variables
config()

// Force Node.js to use Google's public DNS for SRV record resolution.
// Fixes "querySrv ECONNREFUSED" which occurs when local routers' DNS
// servers are unreachable or fail to forward SRV queries correctly.
dns.setServers(['8.8.8.8', '8.8.4.4'])

/**
 * Tracks the current connection status.
 * @type {boolean}
 */
let isConnected = false

/**
 * Establish connection to the MongoDB Atlas Database.
 * Implements guards to prevent redundant connection pools (singleton-like).
 * Configures connection pool parameters, timeouts, and hooks connection event listeners.
 * 
 * @returns {Promise<void>} Resolves when connection succeeds or is already established.
 */
export async function connectDB() {
  if (isConnected) {
    return
  }

  const mongoURI = process.env.MONGODB_URI
  if (!mongoURI) {
    console.warn('[MongoDB] MONGODB_URI is not defined in the environment variables. Database operations will fail.')
    return
  }

  // Connection options for optimal pooling and resilience
  const options = {
    dbName: 'jodein',
    // Connection Pool Settings
    maxPoolSize: 100,             // Maintain up to 100 socket connections
    minPoolSize: 10,              // Keep at least 10 socket connections open
    // Timeout Settings
    serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds of failing to select a server (fail fast)
    socketTimeoutMS: 45000,         // Close sockets after 45 seconds of inactivity
    connectTimeoutMS: 10000,        // Timeout after 10 seconds of initial connection attempt
    heartbeatFrequencyMS: 10000,    // Check server status every 10 seconds
    autoIndex: true,                // Automatically build indexes (set false in high-load production if preferred)
  }

  // Setup connection event logging listeners
  mongoose.connection.on('connecting', () => {
    console.log('[MongoDB] Connecting to database cluster...')
  })

  mongoose.connection.on('connected', () => {
    isConnected = true
    console.log('[MongoDB] Connected successfully ✅')
  })

  mongoose.connection.on('error', (err) => {
    console.error(`[MongoDB] Connection error occurred: ${err.message} ❌`)
    isConnected = false
  })

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Connection lost ⚠️. Mongoose will attempt to automatically reconnect.')
    isConnected = false
  })

  mongoose.connection.on('reconnected', () => {
    isConnected = true
    console.log('[MongoDB] Reconnected successfully ✅')
  })

  mongoose.connection.on('close', () => {
    console.log('[MongoDB] Connection pool closed.')
    isConnected = false
  })

  try {
    await mongoose.connect(mongoURI, options)
  } catch (err) {
    console.error('[MongoDB] Critical: Initial connection failed!', err.message)
    process.exit(1) // Terminate process immediately if DB is unreachable on startup
  }
}

/**
 * Utility function to check database connection status.
 * @returns {boolean} True if Mongoose is connected to the database.
 */
export function isDBConnected() {
  return isConnected
}

export default mongoose
