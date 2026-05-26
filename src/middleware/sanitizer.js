/**
 * src/middleware/sanitizer.js
 * Input validation and sanitization helpers for cybersecurity hardening.
 * Protects against NoSQL injection, timing attacks, and malformed inputs.
 */

import crypto from 'crypto'

/**
 * Deeply sanitizes an object, array, or string to prevent NoSQL injections.
 * Recursively removes any keys starting with '$' or containing '.' in objects.
 * Converts other values to safe types or sanitizes strings.
 */
export function sanitizeNoSQL(input) {
  if (input === null || input === undefined) {
    return input
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeNoSQL(item))
  }

  if (typeof input === 'object') {
    const cleanObj = {}
    for (const key of Object.keys(input)) {
      // Strip keys that start with '$' or contain '.' (classic NoSQL injection vectors)
      if (key.startsWith('$') || key.includes('.')) {
        console.warn(`[Security] NoSQL injection attempt detected and blocked. Stripped key: ${key}`)
        continue
      }
      cleanObj[key] = sanitizeNoSQL(input[key])
    }
    return cleanObj
  }

  if (typeof input === 'string') {
    // Return trimmed and cleaned string, replacing null bytes or control characters
    return input.replace(/\0/g, '').trim()
  }

  return input
}

/**
 * Strips potentially dangerous characters from student roll numbers / student IDs.
 * Roll numbers should be strictly uppercase alphanumeric and optional hyphens/slashes.
 * Standard format example: 2022CSE001, CSE-2022-001.
 */
export function sanitizeRollNumber(rollNum) {
  if (typeof rollNum !== 'string') {
    return ''
  }
  // Remove null characters and any whitespace
  let cleaned = rollNum.replace(/\0/g, '').replace(/\s+/g, '').toUpperCase()
  // Keep only alphanumeric characters, dashes, and slashes
  cleaned = cleaned.replace(/[^A-Z0-9\-\/]/g, '')
  // Limit length to 30 characters to prevent buffer overflow/excessive resource use
  return cleaned.substring(0, 30)
}

/**
 * Sanitizes user message text to strip hazardous characters or control characters.
 * Keeps basic symbols, text, and formatting but removes potentially dangerous exploit sequences.
 */
export function sanitizeUserMessage(message) {
  if (typeof message !== 'string') {
    return ''
  }
  // Strip null bytes and control characters (except newlines and carriage returns)
  let cleaned = message.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  // Limit length to 1000 characters to prevent denial-of-service on LLM/database
  return cleaned.substring(0, 1000).trim()
}

/**
 * Compares two strings in a timing-safe way, even if their lengths differ.
 * By hashing both strings with SHA256 first, we get fixed-length outputs
 * that can be compared safely using crypto.timingSafeEqual.
 */
export function timingSafeCompare(strA, strB) {
  if (typeof strA !== 'string' || typeof strB !== 'string') {
    return false
  }
  const hashA = crypto.createHash('sha256').update(strA).digest()
  const hashB = crypto.createHash('sha256').update(strB).digest()
  return crypto.timingSafeEqual(hashA, hashB)
}

/**
 * Fastify preValidation or preHandler hook for automatic sanitization.
 * Applies NoSQL sanitization to request params, query, and body.
 */
export function fastifySanitizerHook() {
  return async (request, reply) => {
    try {
      if (request.query) {
        request.query = sanitizeNoSQL(request.query)
      }
      if (request.params) {
        request.params = sanitizeNoSQL(request.params)
      }
      // Sanitize body if it exists, but avoid mutating rawBody
      if (request.body && typeof request.body === 'object') {
        request.body = sanitizeNoSQL(request.body)
      }
    } catch (err) {
      console.error('[Security] Error during request sanitization:', err.message)
      // Fail secure: don't let a crash in sanitizer bypass security
      return reply.status(400).send({ error: 'Bad Request: Validation failed' })
    }
  }
}
