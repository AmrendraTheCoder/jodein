// src/whatsapp.js
import crypto from 'crypto'
import { config } from 'dotenv'
import { storeDemoReply } from './redis.js'
config()

// Parse the raw webhook payload into a clean object
export function parseIncomingMessage(body) {
  try {
    const entry   = body?.entry?.[0]
    const change  = entry?.changes?.[0]
    const value   = change?.value

    // PATTERN 1 (from Meta's whatsapp-api-examples analysis):
    // Meta sends TWO types of webhook events:
    //   1. Message events  → value.messages exists
    //   2. Status updates  → value.statuses exists (delivered, read, failed)
    // We only want to process actual messages. Status-only payloads must be
    // silently discarded here before they hit the queue.
    if (value?.statuses && !value?.messages) {
      return null  // status-only webhook — skip silently
    }

    const message = value?.messages?.[0]
    const contact = value?.contacts?.[0]

    // If there's no message, it might be a status update (delivered, read)
    // We ignore those for now
    if (!message) return null

    // Only handle text messages for now
    // We'll add image/audio support in a later step
    if (message.type !== 'text') {
      console.log(`Non-text message received: ${message.type} — skipping for now`)
      return null
    }

    return {
      from:      message.from,                    // "919876543210"
      messageId: message.id,                       // "wamid.XXXX"
      text:      message.text.body,               // "hello"
      name:      contact?.profile?.name || 'User', // "Rahul Kumar"
      timestamp: parseInt(message.timestamp),     // Unix timestamp
    }

  } catch (err) {
    console.error('Error parsing incoming message:', err)
    return null
  }
}

// Send a text reply to a user
// In DEMO_MODE=true, stores the reply in Redis instead of calling Meta API
// Swap DEMO_MODE to false (or remove it) when you have a real Meta account ready
// Step 12 update: accepts optional 'credentials' object from college config.
// { phoneNumberId, accessToken } from MongoDB — enables multi-college WhatsApp.
// Falls back to env vars when credentials is null (demo mode / single college).
export async function sendTextMessage(toNumber, messageText, credentials = null) {
  // --- DEMO MODE: bypass Meta API ---
  if (process.env.DEMO_MODE === 'true') {
    await storeDemoReply(toNumber, messageText)
    console.log(`[DEMO] Reply stored for session ${toNumber}: ${messageText.substring(0, 60)}...`)
    return { success: true, demo: true }
  }

  // Resolve credentials: use college-specific if provided, fall back to env
  const phoneNumberId = credentials?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken   = credentials?.accessToken   || process.env.WHATSAPP_ACCESS_TOKEN

  // --- PRODUCTION: send via Meta Cloud API ---
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`

  const body = {
    messaging_product: 'whatsapp',
    recipient_type:    'individual',
    to:                toNumber,
    type:              'text',
    text: {
      preview_url: false,
      body:        messageText
    }
  }

  try {
    const response = await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('WhatsApp API error:', JSON.stringify(data))
      return { success: false, error: data }
    }

    console.log(`Message sent to ${toNumber}: ${messageText.substring(0, 50)}...`)
    return { success: true, data }

  } catch (err) {
    console.error('Network error sending message:', err.message)
    return { success: false, error: err.message }
  }
}

// Show the "typing..." indicator in the user's WhatsApp chat
// Call this BEFORE making the LLM call
// In DEMO_MODE, this is a no-op (the UI shows its own typing animation)
// Step 12 update: accepts optional credentials for per-college WhatsApp number
export async function sendTypingIndicator(toNumber, incomingMessageId, credentials = null) {
  // --- DEMO MODE: no-op ---
  if (process.env.DEMO_MODE === 'true') {
    console.log(`[DEMO] Typing indicator for ${toNumber} (skipped in demo mode)`)
    return
  }

  const phoneNumberId = credentials?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken   = credentials?.accessToken   || process.env.WHATSAPP_ACCESS_TOKEN
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`

  // To show typing, mark the incoming message as "read"
  // WhatsApp shows typing indicator when a message is read but not yet replied to
  const body = {
    messaging_product: 'whatsapp',
    status:            'read',
    message_id:        incomingMessageId
  }

  try {
    await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body)
    })
    // Non-critical — if typing fails, reply still works
  } catch (err) {
    console.warn('[WhatsApp] Could not send typing indicator:', err.message)
  }
}

// Verify that a webhook request is genuinely from Meta
// Uses HMAC-SHA256 signature verification
export function verifyWebhookSignature(rawBody, signatureHeader) {
  try {
    if (!process.env.META_APP_SECRET) {
      console.error('[Security] META_APP_SECRET is not configured in environment variables')
      return false
    }

    if (!signatureHeader) {
      console.warn('[Security] No signature header — rejecting request')
      return false
    }

    if (!rawBody) {
      console.warn('[Security] Empty raw body — rejecting request')
      return false
    }

    // Header format: "sha256=abc123..."
    const parts = signatureHeader.split('=')
    if (parts.length !== 2) {
      console.warn('[Security] Invalid signature header format')
      return false
    }

    const [algorithm, signature] = parts

    if (algorithm !== 'sha256') {
      console.warn('[Security] Unexpected signature algorithm:', algorithm)
      return false
    }

    if (!signature) {
      console.warn('[Security] Signature value is empty')
      return false
    }

    // Compute expected signature using your app secret
    const expectedSignature = crypto
      .createHmac('sha256', process.env.META_APP_SECRET)
      .update(rawBody, 'utf8')
      .digest('hex')

    // Use timingSafeEqual to prevent timing attacks
    const signatureBuffer = Buffer.from(signature, 'hex')
    const expectedBuffer  = Buffer.from(expectedSignature, 'hex')

    // timingSafeEqual throws an error if lengths do not match.
    // Early return is safe here because the length of the expected digest is always 32 bytes (64 hex characters),
    // which is public knowledge. However, to keep code robust and prevent any crash, we compare lengths.
    if (signatureBuffer.length !== expectedBuffer.length) {
      console.warn('[Security] Signature length mismatch')
      return false
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer)

  } catch (err) {
    // Handle error gracefully and never leak credentials or internal paths in logs
    console.error('[Security] Webhook signature verification error:', err.message)
    return false
  }
}
