// src/middleware/rateLimiter.js
import { redis } from '../redis.js'
import { Student } from '../models/Student.js'

const LIMIT = 20
const WINDOW_MS = 3600 * 1000 // 1 hour in ms

/**
 * Core sliding-window rate limiter using Upstash Redis.
 * Limits student roll numbers to a maximum of 20 queries per hour.
 * Fail-open capability: if Upstash Redis has a connection drop or fails,
 * it returns allowed: true with a warning to ensure the bot doesn't freeze.
 *
 * @param {string} studentId - The student roll number
 * @returns {Promise<{ allowed: boolean, remaining: number }>}
 */
export async function checkRateLimit(studentId) {
  if (!studentId) {
    return { allowed: true, remaining: LIMIT }
  }

  const key = `ratelimit:student:${studentId}`
  const now = Date.now()
  const windowStart = now - WINDOW_MS

  try {
    // 1. Run a pipeline to clear older queries and fetch the current count
    const pipeline = redis.pipeline()
    pipeline.zremrangebyscore(key, 0, windowStart)
    pipeline.zcard(key)

    const results = await pipeline.exec()
    const count = results[1]

    if (count >= LIMIT) {
      return { allowed: false, remaining: 0 }
    }

    // 2. Add current request to sliding window and set 1-hour expiration
    const member = `${now}-${Math.random().toString(36).slice(2, 9)}`
    const savePipeline = redis.pipeline()
    savePipeline.zadd(key, { score: now, member })
    savePipeline.expire(key, 3600) // 1 hour TTL
    await savePipeline.exec()

    return { allowed: true, remaining: LIMIT - (count + 1) }
  } catch (err) {
    // Fail-open gracefully on Redis failure
    console.warn(`[RateLimiter] Upstash Redis failure: ${err.message}. Failing open gracefully.`)
    return { allowed: true, remaining: LIMIT }
  }
}

/**
 * Fastify preHandler hook / middleware.
 * Can be used as a Fastify route hook or loaded directly.
 */
export async function rateLimiterHook(request, reply) {
  try {
    let phone = null
    let collegeId = null

    if (request.body) {
      if (request.body.sessionId) {
        phone = request.body.sessionId
        collegeId = 'demo'
      } else {
        // Parse WhatsApp incoming webhook payload
        const entry = request.body.entry?.[0]
        const change = entry?.changes?.[0]
        const message = change?.value?.messages?.[0]
        if (message) {
          phone = message.from
        }
      }
    }

    if (!phone) return

    collegeId = request.params.collegeId || collegeId || 'demo'

    // Look up student to get their studentId (roll number)
    const student = await Student.findOne({ collegeId, phone, activated: true })
    if (!student || !student.studentId) return

    const { allowed } = await checkRateLimit(student.studentId)

    if (!allowed) {
      request.log.warn(`[RateLimiter] Rate limit exceeded for student roll number: ${student.studentId}`)
      
      if (request.url.startsWith('/demo')) {
        return reply.status(429).send({
          error: 'Too Many Requests',
          message: 'Aapka rate limit exceed ho gaya hai (Max 20 queries per hour). Please thodi der baad try karein.'
        })
      }
      
      // Store rate-limiting info on the request object so handlers can react appropriately
      request.isRateLimited = true
      request.studentId = student.studentId
    }
  } catch (err) {
    request.log.error(`[RateLimiter] Hook error: ${err.message}`)
  }
}
