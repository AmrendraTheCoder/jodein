// src/routes/webhook.js
// Decoupled, hardened WhatsApp webhooks routes.

import { parseIncomingMessage, verifyWebhookSignature } from '../whatsapp.js'
import { isMessageProcessed, markMessageProcessed } from '../redis.js'

export default async function webhookRoutes(fastify, options) {
  
  // ─── GET /webhook/:collegeId ───────────────────────────────────────────────
  // Meta Webhook Verification handshake (GET)
  fastify.get('/webhook/:collegeId', async (req, reply) => {
    const { collegeId } = req.params

    // Meta sends these as query parameters during validation
    const mode      = req.query['hub.mode']
    const token     = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    fastify.log.info(`Webhook verification request for college: ${collegeId}`)
    fastify.log.info(`Mode: ${mode}, Token matches: ${token === process.env.WEBHOOK_VERIFY_TOKEN}`)

    // Validate verify token match
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      fastify.log.info('Webhook verified successfully')
      return reply.status(200).send(challenge)
    } else {
      fastify.log.warn('Webhook verification FAILED — token mismatch')
      return reply.status(403).send('Forbidden')
    }
  })

  // ─── POST /webhook/:collegeId ──────────────────────────────────────────────
  // Hardened message webhook receiver (POST)
  fastify.post('/webhook/:collegeId', {
    config: {
      rawBody: true,
      // In-route rate limit per college Id to isolate tenants
      rateLimit: {
        max: 300,
        timeWindow: '1 minute',
        keyGenerator: (req) => req.params.collegeId || req.ip,
        exponentialBackoff: true
      }
    }
  }, async (req, reply) => {
    const { collegeId } = req.params

    // 1. Verify the signature is genuine
    const signatureHeader = req.headers['x-hub-signature-256']
    const isValid         = verifyWebhookSignature(req.rawBody, signatureHeader)

    if (!isValid) {
      fastify.log.warn(`INVALID SIGNATURE — rejecting request from: ${req.ip}`)
      return reply.status(403).send('Forbidden')
    }

    // Acknowledge receipt to Meta immediately (prevents duplicate retries from Meta)
    reply.status(200).send('OK')

    // Parse payload
    const parsed = parseIncomingMessage(req.body)
    if (!parsed) return

    // 2. Deduplicate message using Redis cache
    const alreadyProcessed = await isMessageProcessed(parsed.messageId)
    if (alreadyProcessed) {
      fastify.log.info(`Duplicate message ${parsed.messageId} — skipping`)
      return
    }

    // Mark as processed in Redis immediately to block race conditions
    await markMessageProcessed(parsed.messageId)

    // Push into BullMQ processing queue
    const { messageQueue } = await import('../queue.js')
    if (!messageQueue) {
      fastify.log.error('messageQueue is not initialized — set BULLMQ_REDIS_URL in .env')
      return
    }
    
    await messageQueue.add('process-message', { collegeId, parsed }, {
      jobId: parsed.messageId
    })

    fastify.log.info(`[Webhook] Verified + queued message ${parsed.messageId}`)
  })
}
