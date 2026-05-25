// src/db.js
// Singleton MongoDB connection — call connectDB() once at startup
// Subsequent calls are no-ops (guards against double-connect)
import mongoose from 'mongoose'
import dns      from 'dns'
import { config } from 'dotenv'
config()

// Force Node.js to use Google's public DNS for SRV record resolution.
// Fixes "querySrv ECONNREFUSED" that occurs when the local router's DNS
// server is unreachable or doesn't forward SRV queries correctly.
// Safe to set globally — does not affect any other part of the app.
dns.setServers(['8.8.8.8', '8.8.4.4'])

let isConnected = false

export async function connectDB() {
  if (isConnected) return

  if (!process.env.MONGODB_URI) {
    console.warn('[MongoDB] MONGODB_URI not set — database features disabled')
    return
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'jodein',
    })
    isConnected = true
    console.log('[MongoDB] Connected ✅')

    // Log disconnection events so Railway logs make it obvious
    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Disconnected — will auto-reconnect')
      isConnected = false
    })
    mongoose.connection.on('reconnected', () => {
      console.log('[MongoDB] Reconnected ✅')
      isConnected = true
    })

  } catch (err) {
    console.error('[MongoDB] Connection failed:', err.message)
    process.exit(1)  // don't start if DB is misconfigured — fail loud
  }
}

export function isDBConnected() {
  return isConnected
}
