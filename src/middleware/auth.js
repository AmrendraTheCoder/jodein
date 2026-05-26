// src/middleware/auth.js
// ADIP token and API key verification middleware.
// Ensures request is from a valid, active college tenant.

import { College } from '../models/College.js'

/**
 * Fastify preHandler hook to authenticate calls using x-api-key or Authorization Bearer token.
 * Populates req.college and req.collegeId on success.
 */
export async function authenticateApiKey(req, reply) {
  const authHeader = req.headers.authorization
  let apiKey = req.headers['x-api-key']

  if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7)
  }

  if (!apiKey) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing API key. Provide x-api-key or Authorization Bearer token.'
    })
  }

  // Look up college by apiKey
  const college = await College.findOne({ apiKey, status: 'active' })
  if (!college) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Invalid API key or inactive college tenant.'
    })
  }

  // Attach collegeId and college object to request for downstream handlers
  req.college = college
  req.collegeId = college.collegeId
}
