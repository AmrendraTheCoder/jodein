// src/configCache.js
// In-memory cache for college configurations.
// MongoDB is called at most once per college per 5 minutes.
// Without this, every single message would hit MongoDB — expensive at scale.
//
// Cache is intentionally in-memory (not Redis) because:
//   1. College configs almost never change
//   2. If the server restarts, it reloads from MongoDB (acceptable)
//   3. Adding Redis here would add latency to every message

import { College } from './models/College.js'

const cache     = new Map()         // collegeId → { config, fetchedAt }
const CACHE_TTL = 5 * 60 * 1000    // 5 minutes in ms

/**
 * Get college config — from cache if fresh, from MongoDB otherwise.
 * Returns null if college not found or not active.
 */
export async function getCollegeConfig(collegeId) {
  const now    = Date.now()
  const cached = cache.get(collegeId)

  // Return cached version if it exists and is still fresh
  if (cached && (now - cached.fetchedAt) < CACHE_TTL) {
    return cached.config
  }

  // Cache miss or stale — fetch from MongoDB
  const college = await College.findOne({ collegeId, status: 'active' })

  if (!college) {
    console.warn(`[ConfigCache] No active college found for id: ${collegeId}`)
    return null
  }

  cache.set(collegeId, { config: college, fetchedAt: now })
  console.log(`[ConfigCache] Loaded config for: ${collegeId}`)

  return college
}

/**
 * Force-expire a college's cached config.
 * Call this from the dashboard API whenever a college admin saves changes.
 * Without this, dashboard changes take up to 5 minutes to take effect.
 */
export function invalidateCache(collegeId) {
  cache.delete(collegeId)
  console.log(`[ConfigCache] Invalidated config for: ${collegeId}`)
}

/**
 * Get all currently cached college IDs (for debugging/monitoring).
 */
export function getCachedColleges() {
  return [...cache.keys()]
}
