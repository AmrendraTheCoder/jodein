// src/redis.js
import { Redis } from '@upstash/redis'
import { config } from 'dotenv'
config()

// Create the client — reads from env automatically
export const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Test the connection (call this once on startup)
export async function testRedisConnection() {
  // Skip test if credentials are not configured
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('[Redis] Upstash credentials not set — Redis features disabled. Conversation history will not persist.')
    return
  }
  try {
    await redis.set('connection_test', 'ok')
    const val = await redis.get('connection_test')
    console.log('Redis connected:', val === 'ok' ? 'SUCCESS' : 'FAIL')
  } catch (err) {
    console.error('Redis connection failed:', err.message)
  }
}

// --- Conversation History ---

const HISTORY_KEY_PREFIX = 'chat:'
const MAX_HISTORY_LENGTH = 10  // keep last 10 messages per user

// Key structure: "chat:{collegeId}:{userId}"
// Example:       "chat:lnmiit:919876543210"
// This ensures each college's data is completely separate

function historyKey(collegeId, userId) {
  return `${HISTORY_KEY_PREFIX}${collegeId}:${userId}`
}

// Get conversation history for a user
export async function getHistory(collegeId, userId) {
  try {
    const key     = historyKey(collegeId, userId)
    const history = await redis.get(key)
    return history ? JSON.parse(history) : []
  } catch (err) {
    console.error('Error getting history:', err.message)
    return []   // return empty array on error — bot still works, just without memory
  }
}

// Add a message to history
// role: "user" or "assistant"
// content: the message text
export async function addToHistory(collegeId, userId, role, content) {
  try {
    const key     = historyKey(collegeId, userId)
    const history = await getHistory(collegeId, userId)

    // Add new message
    history.push({ role, content })

    // Keep only last MAX_HISTORY_LENGTH messages
    // This controls cost and speed — fewer messages = faster LLM responses
    const trimmed = history.slice(-MAX_HISTORY_LENGTH)

    // Store back in Redis with 24-hour TTL
    // TTL (Time To Live) = after 24 hours of no messages, history is deleted
    // This prevents Redis from filling up with stale data
    await redis.set(key, JSON.stringify(trimmed), { ex: 86400 }) // 86400 seconds = 24 hours

  } catch (err) {
    console.error('Error adding to history:', err.message)
    // Non-critical — continue even if history save fails
  }
}

// Clear history for a user (useful for "start over" command)
export async function clearHistory(collegeId, userId) {
  try {
    const key = historyKey(collegeId, userId)
    await redis.del(key)
    console.log(`Cleared history for ${userId} at ${collegeId}`)
  } catch (err) {
    console.error('Error clearing history:', err.message)
  }
}

// --- Deduplication ---

// Check if we've already processed a message
// Prevents double replies when Meta sends the same message twice
export async function isMessageProcessed(messageId) {
  try {
    const key    = `dedup:${messageId}`
    const exists = await redis.get(key)
    return exists !== null
  } catch (err) {
    console.error('Dedup check error:', err.message)
    return false // if Redis is down, process the message anyway
  }
}

export async function markMessageProcessed(messageId) {
  try {
    const key = `dedup:${messageId}`
    // Keep dedup record for 10 minutes — long enough to catch retries
    await redis.set(key, '1', { ex: 600 })
  } catch (err) {
    console.error('Dedup mark error:', err.message)
  }
}

// --- Demo Mode ---
// These functions replace the Meta API in DEMO_MODE=true.
// Bot replies are stored in Redis and polled by the demo UI instead
// of being sent via WhatsApp. Swap out with the real Meta API when ready.

// Store a bot reply for a demo session
// Called by whatsapp.js instead of the Meta send API when DEMO_MODE=true
export async function storeDemoReply(sessionId, messageText) {
  try {
    const key = `demo:replies:${sessionId}`
    // RPUSH appends to the list; poll endpoint reads + clears with LRANGE + DEL
    await redis.rpush(key, JSON.stringify({ text: messageText, timestamp: Date.now() }))
    // 5-minute TTL — if nobody polls, don't leave stale data
    await redis.expire(key, 300)
  } catch (err) {
    console.error('Error storing demo reply:', err.message)
  }
}

// Retrieve and clear all pending bot replies for a session
// Called by GET /demo/messages/:sessionId
export async function getDemoReplies(sessionId) {
  try {
    const key = `demo:replies:${sessionId}`
    const raw = await redis.lrange(key, 0, -1)
    if (raw && raw.length > 0) {
      await redis.del(key) // consume once — like reading a notification
      return raw.map(m => JSON.parse(m))
    }
    return []
  } catch (err) {
    console.error('Error getting demo replies:', err.message)
    return []
  }
}
