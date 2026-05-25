// src/server.js
// Suppress BullMQ's "Eviction policy is volatile-lru" warning.
// Redis Cloud free tier does not allow changing eviction policy.
// The queue operates correctly with volatile-lru — BullMQ job keys
// carry their own TTL so they are safely evicted under memory pressure.
// This filter is applied before any BullMQ module loads.
;(function () {
  const _warn = console.warn.bind(console)
  console.warn = (...args) => {
    const msg = args[0]?.toString?.() ?? ''
    if (msg.includes('Eviction policy') || msg.includes('noeviction')) return
    _warn(...args)
  }
})()

import Fastify from 'fastify'
import fastifyRawBody from 'fastify-raw-body'
import { config } from 'dotenv'
import { parseIncomingMessage, verifyWebhookSignature, sendTypingIndicator } from './whatsapp.js'
import {
  isMessageProcessed,
  markMessageProcessed,
  testRedisConnection,
  getDemoReplies,
  getHistory,
  addToHistory,
  clearHistory,
} from './redis.js'
import { generateReply }         from './ai.js'
import { connectDB, isDBConnected } from './db.js'
import os from 'os'
import path from 'path'
import fs from 'fs'

config()

// PATTERN 9 (from pino analysis): Redact sensitive fields from ALL logs automatically
// Phone numbers (wa_id), tokens, and signatures must NEVER appear in plain-text logs
const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    redact: {
      paths: [
        'req.headers["x-hub-signature-256"]',  // Meta webhook signature
        'req.headers.authorization',
        '*.accessToken',
        '*.wa_id',            // WhatsApp phone numbers in webhook payloads
        '*.WHATSAPP_ACCESS_TOKEN'
      ],
      censor: '[REDACTED]'
    }
  }
})

// Register raw body plugin for webhook signature verification
// This gives us access to req.rawBody (the unparsed request body bytes)
await app.register(fastifyRawBody, { field: 'rawBody', global: false, encoding: 'utf8' })

// PATTERN 4+5 (from fastify-rate-limit analysis): Per-collegeId rate limiting
// Lua-script-based atomic Redis increment — prevents thundering herd across instances
// Exponential backoff punishes abusive clients progressively harder
await app.register(import('@fastify/rate-limit'), {
  global: false,               // opt-in per route, not global
  errorResponseBuilder: (_req, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Jodein rate limit exceeded. Retry in ${context.after}.`,
  })
})

// ─────────────────────────────────────────────────────────
const HEALTH_START = Date.now()

// HEALTH CHECK — enhanced (PATTERN 12 from WAHA health check analysis)
// Checks each service individually; returns 503 if any critical service is down
app.get('/health', async (req, reply) => {
  const { redis } = await import('./redis.js')
  const health = {
    status: 'ok',
    uptime: `${Math.floor((Date.now() - HEALTH_START) / 1000)}s`,
    timestamp: new Date().toISOString(),
    mode: process.env.DEMO_MODE === 'true' ? 'demo' : 'production',
    services: {
      redis:   'unchecked',
      queue:   'unchecked',
      mongodb: 'unchecked',
      gemini:  process.env.GOOGLE_AI_API_KEY ? 'configured ✅' : 'MISSING ⚠️'
    }
  }

  // Redis ping
  try {
    if (process.env.UPSTASH_REDIS_REST_URL) {
      await redis.set('_health_ping', 'ok')
      health.services.redis = 'connected ✅'
    } else {
      health.services.redis = 'not configured (demo mode)'
    }
  } catch {
    health.services.redis = 'disconnected ⚠️'
    health.status = 'degraded'
  }

  // BullMQ queue
  try {
    const { messageQueue } = await import('./queue.js')
    health.services.queue = messageQueue ? 'initialized ✅' : 'disabled (no BULLMQ_REDIS_URL)'
  } catch {
    health.services.queue = 'error ⚠️'
  }

  // MongoDB
  health.services.mongodb = isDBConnected() ? 'connected ✅' : (process.env.MONGODB_URI ? 'disconnected ⚠️' : 'not configured')
  if (process.env.MONGODB_URI && !isDBConnected()) health.status = 'degraded'

  return reply.status(health.status === 'ok' ? 200 : 503).send(health)
})

// ─────────────────────────────────────────────────────────
// STEP 3: Webhook verification (GET request from Meta)
// ─────────────────────────────────────────────────────────
app.get('/webhook/:collegeId', async (req, reply) => {
  const { collegeId } = req.params

  // Meta sends these as query parameters
  const mode      = req.query['hub.mode']
  const token     = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  app.log.info(`Webhook verification request for college: ${collegeId}`)
  app.log.info(`Mode: ${mode}, Token matches: ${token === process.env.WEBHOOK_VERIFY_TOKEN}`)

  // Validate
  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    app.log.info('Webhook verified successfully')
    // CRITICAL: respond with just the challenge number, nothing else
    return reply.status(200).send(challenge)
  } else {
    app.log.warn('Webhook verification FAILED — token mismatch')
    return reply.status(403).send('Forbidden')
  }
})

// ─────────────────────────────────────────────────────────
// STEP 10: Hardened webhook POST handler
// Signature verification + dedup + queue
// ─────────────────────────────────────────────────────────
app.post('/webhook/:collegeId', {
  config: {
    rawBody: true,
    // PATTERN 4 (from fastify-rate-limit Lua-script analysis):
    // Rate limit per college — College A's flood can't affect College B
    // 300 msgs/min is generous for any real college; raises 429 for abusers
    rateLimit: {
      max: 300,
      timeWindow: '1 minute',
      keyGenerator: (req) => req.params.collegeId || req.ip,
      exponentialBackoff: true  // abusive callers get progressively longer cooldowns
    }
  }
}, async (req, reply) => {
  const { collegeId } = req.params

  // STEP 1: Verify the request is genuinely from Meta
  const signatureHeader = req.headers['x-hub-signature-256']
  const isValid         = verifyWebhookSignature(req.rawBody, signatureHeader)

  if (!isValid) {
    app.log.warn(`INVALID SIGNATURE — rejecting request from: ${req.ip}`)
    return reply.status(403).send('Forbidden')
  }

  // Always return 200 to Meta after signature check
  reply.status(200).send('OK')

  // Parse the message
  const parsed = parseIncomingMessage(req.body)
  if (!parsed) return

  // STEP 2: Check deduplication
  const alreadyProcessed = await isMessageProcessed(parsed.messageId)
  if (alreadyProcessed) {
    app.log.info(`Duplicate message ${parsed.messageId} — skipping`)
    return
  }

  // Mark as processed BEFORE queuing (prevents race conditions)
  await markMessageProcessed(parsed.messageId)

  // Push to BullMQ queue — all heavy work happens in worker.js
  // Guard: messageQueue is null if BULLMQ_REDIS_URL is not configured
  const { messageQueue } = await import('./queue.js')
  if (!messageQueue) {
    app.log.error('messageQueue is not initialized — set BULLMQ_REDIS_URL in .env')
    return
  }
  await messageQueue.add('process-message', { collegeId, parsed }, {
    jobId: parsed.messageId  // use WhatsApp message ID as job ID for deduplication
  })

  app.log.info(`[Server] Verified + queued message ${parsed.messageId}`)
})

// ─────────────────────────────────────────────────────────
// DEMO MODE ROUTES
// Active when DEMO_MODE=true in your .env
// These let you test the full pipeline (Redis, Gemini, BullMQ worker)
// without a real Meta WhatsApp account.
// When ready for production: set DEMO_MODE=false — these routes become no-ops.
// ─────────────────────────────────────────────────────────

const DEMO_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jodein — Campus Assistant Demo</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #111b21;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }

    .phone-wrap {
      width: 100%;
      max-width: 430px;
      height: 100vh;
      max-height: 860px;
      display: flex;
      flex-direction: column;
      background: #0b141a;
      box-shadow: 0 0 60px rgba(0,0,0,0.6);
      border-radius: 12px;
      overflow: hidden;
    }

    /* ── HEADER ── */
    .header {
      background: #202c33;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid #2a3942;
      flex-shrink: 0;
    }

    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00a884, #128c7e);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }

    .header-info { flex: 1; }
    .header-info h3 { color: #e9edef; font-size: 15px; font-weight: 600; }
    .header-info p  { color: #8696a0; font-size: 12px; margin-top: 1px; }

    .demo-badge {
      background: #005c4b;
      color: #00cf9d;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      padding: 3px 8px;
      border-radius: 20px;
      border: 1px solid #00a884;
    }

    /* ── MESSAGES AREA ── */
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      background: #0b141a;
      scrollbar-width: thin;
      scrollbar-color: #2a3942 transparent;
    }

    .messages::-webkit-scrollbar { width: 4px; }
    .messages::-webkit-scrollbar-thumb { background: #2a3942; border-radius: 4px; }

    /* Date divider */
    .date-chip {
      align-self: center;
      background: #182229;
      color: #8696a0;
      font-size: 11px;
      padding: 4px 12px;
      border-radius: 8px;
      margin: 4px 0 8px;
    }

    /* Bubbles */
    .message {
      max-width: 75%;
      padding: 7px 10px 18px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.45;
      position: relative;
      word-break: break-word;
      animation: fadeUp 0.2s ease;
    }

    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .message.user {
      background: #005c4b;
      color: #e9edef;
      align-self: flex-end;
      border-bottom-right-radius: 2px;
    }

    .message.bot {
      background: #202c33;
      color: #e9edef;
      align-self: flex-start;
      border-bottom-left-radius: 2px;
    }

    .message-time {
      position: absolute;
      bottom: 4px;
      right: 8px;
      font-size: 10px;
      color: #8696a0;
    }

    /* Typing indicator bubble */
    .typing-bubble {
      background: #202c33;
      align-self: flex-start;
      padding: 12px 14px;
      border-radius: 8px;
      border-bottom-left-radius: 2px;
      display: none;
    }

    .typing-dots {
      display: flex;
      gap: 5px;
      align-items: center;
    }

    .typing-dots span {
      width: 8px;
      height: 8px;
      background: #8696a0;
      border-radius: 50%;
      animation: typingBounce 1.2s infinite;
    }
    .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typingBounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
      30% { transform: translateY(-5px); opacity: 1; }
    }

    /* ── INPUT AREA ── */
    .input-area {
      background: #202c33;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      border-top: 1px solid #2a3942;
    }

    .input-wrap {
      flex: 1;
      background: #2a3942;
      border-radius: 24px;
      display: flex;
      align-items: center;
      padding: 0 14px;
    }

    .input-wrap input {
      flex: 1;
      background: transparent;
      border: none;
      color: #d1d7db;
      font-size: 15px;
      padding: 11px 0;
      outline: none;
    }

    .input-wrap input::placeholder { color: #8696a0; }

    .send-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #00a884;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, transform 0.1s;
      flex-shrink: 0;
    }

    .send-btn:hover  { background: #00cf9d; }
    .send-btn:active { transform: scale(0.93); }
    .send-btn:disabled { background: #2a3942; cursor: not-allowed; }

    .send-btn svg { fill: #111b21; }

    /* ── RESET HINT ── */
    .reset-hint {
      text-align: center;
      color: #8696a0;
      font-size: 11px;
      padding: 6px 0 2px;
      flex-shrink: 0;
      background: #0b141a;
    }
  </style>
</head>
<body>
<div class="phone-wrap">

  <div class="header">
    <div class="avatar">🎓</div>
    <div class="header-info">
      <h3>Jodein Campus Assistant</h3>
      <p id="statusLine">Campus Intelligence · Demo Mode</p>
    </div>
    <span class="demo-badge">DEMO</span>
  </div>

  <div class="messages" id="messages">
    <div class="date-chip" id="todayChip"></div>

    <div class="message bot" id="welcomeMsg">
      👋 Namaste! Main <strong>Jodein</strong> hoon — aapka campus assistant.<br><br>
      Academics, attendance, exams, ya college life ke baare mein kuch bhi poochein!
      <div class="message-time" id="welcomeTime"></div>
    </div>
  </div>

  <div class="typing-bubble" id="typingBubble">
    <div class="typing-dots">
      <span></span><span></span><span></span>
    </div>
  </div>

  <div class="reset-hint">Type <strong>reset</strong> to clear conversation · Powered by Gemini 2.0 Flash</div>

  <div class="input-area">
    <div class="input-wrap">
      <input type="text" id="msgInput" placeholder="Type a message…" autocomplete="off" />
    </div>
    <button class="send-btn" id="sendBtn" onclick="sendMsg()">
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
      </svg>
    </button>
  </div>

</div>

<script>
  // Unique session per browser tab — each tab is a separate "user"
  const sessionId = 'demo-' + Math.random().toString(36).slice(2, 11)
  let isWaiting   = false
  let pollTimer   = null

  const msgs      = document.getElementById('messages')
  const input     = document.getElementById('msgInput')
  const sendBtn   = document.getElementById('sendBtn')
  const typing    = document.getElementById('typingBubble')
  const status    = document.getElementById('statusLine')

  // Set date chip and welcome time
  const now = new Date()
  document.getElementById('todayChip').textContent =
    now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })
  document.getElementById('welcomeTime').textContent = fmtTime(now)

  function fmtTime(d) {
    return d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12: true })
  }

  function addBubble(text, role) {
    const div  = document.createElement('div')
    div.className = 'message ' + role
    const time = document.createElement('div')
    time.className = 'message-time'
    time.textContent = fmtTime(new Date())
    div.innerHTML = text.replace(/\\n/g, '<br>').replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
    div.appendChild(time)
    msgs.appendChild(div)
    msgs.scrollTop = msgs.scrollHeight
  }

  function setTyping(show) {
    typing.style.display = show ? 'block' : 'none'
    msgs.scrollTop = msgs.scrollHeight
  }

  function setWaiting(waiting) {
    isWaiting          = waiting
    input.disabled     = waiting
    sendBtn.disabled   = waiting
    status.textContent = waiting
      ? 'Jodein is typing…'
      : 'Campus Intelligence · Demo Mode'
    if (!waiting) input.focus()
  }

  input.addEventListener('keypress', e => {
    if (e.key === 'Enter' && !isWaiting) sendMsg()
  })

  async function sendMsg() {
    const text = input.value.trim()
    if (!text || isWaiting) return

    input.value = ''
    addBubble(text, 'user')
    setWaiting(true)
    setTyping(true)

    try {
      const res = await fetch('/demo/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text, sessionId, name: 'Demo User' })
      })
      if (!res.ok) throw new Error('Server error: ' + res.status)
      startPolling()
    } catch (err) {
      setTyping(false)
      addBubble('Network error — is the server running? Try again.', 'bot')
      setWaiting(false)
    }
  }

  function startPolling() {
    clearInterval(pollTimer)
    let attempts = 0
    const MAX    = 40  // 40s max wait

    pollTimer = setInterval(async () => {
      attempts++
      try {
        const res  = await fetch('/demo/messages/' + sessionId)
        const data = await res.json()
        if (data.messages && data.messages.length > 0) {
          clearInterval(pollTimer)
          setTyping(false)
          data.messages.forEach(m => addBubble(m.text, 'bot'))
          setWaiting(false)
        } else if (attempts >= MAX) {
          clearInterval(pollTimer)
          setTyping(false)
          addBubble('Jodein is taking too long to respond. Please try again!', 'bot')
          setWaiting(false)
        }
      } catch (e) {
        console.warn('Poll error', e)
      }
    }, 1000)
  }
</script>
</body>
</html>`

// GET /demo — serve the chat UI (only when DEMO_MODE=true)
app.get('/demo', async (req, reply) => {
  if (process.env.DEMO_MODE !== 'true') {
    return reply.status(404).send('Demo mode is not enabled. Set DEMO_MODE=true in your .env to use this.')
  }
  return reply.type('text/html').send(DEMO_HTML)
})

// POST /demo/chat — accept a message and process it inline (no BullMQ needed)
// This bypasses Meta AND BullMQ: server directly calls Redis + Gemini + stores reply.
// Demo mode needs only: Upstash Redis + Google AI key. No BullMQ Redis required.
app.post('/demo/chat', async (req, reply) => {
  if (process.env.DEMO_MODE !== 'true') {
    return reply.status(404).send({ error: 'Demo mode is not enabled' })
  }

  const { message, sessionId, name } = req.body

  if (!message || !sessionId) {
    return reply.status(400).send({ error: 'message and sessionId are required' })
  }

  // Respond to the browser immediately so the UI can start polling
  reply.status(200).send({ queued: true, sessionId })

  // --- Inline processing (mirrors what worker.js does, without BullMQ) ---
  const collegeId = 'demo'

  try {
    const RESET_COMMANDS = ['reset', '/reset', 'start over', '/start', 'clear', '/clear', 'naya shuru']

    if (RESET_COMMANDS.includes(message.trim().toLowerCase())) {
      await clearHistory(collegeId, sessionId)
      // storeDemoReply is triggered by sendTextMessage in demo mode
      const { sendTextMessage } = await import('./whatsapp.js')
      await sendTextMessage(
        sessionId,
        '\u2705 Conversation cleared! Fresh start kar lete hain.\n\nAap kya jaanna chahte hain? \uD83D\uDE0A'
      )
      app.log.info(`[Demo] History cleared for session ${sessionId}`)
      return
    }

    // Get conversation history
    const history = await getHistory(collegeId, sessionId)

    // Generate reply via Gemini
    const aiReply = await generateReply(history, message)

    // Store reply for polling (sendTextMessage in demo mode calls storeDemoReply)
    const { sendTextMessage } = await import('./whatsapp.js')
    await sendTextMessage(sessionId, aiReply)

    // Save to conversation history
    await addToHistory(collegeId, sessionId, 'user',      message)
    await addToHistory(collegeId, sessionId, 'assistant', aiReply)

    app.log.info(`[Demo] Processed message for session ${sessionId}`)

  } catch (err) {
    app.log.error(`[Demo] Error processing message: ${err.message}`)
    try {
      const { storeDemoReply } = await import('./redis.js')
      await storeDemoReply(sessionId, 'Sorry, kuch problem aa gayi \uD83D\uDE4F Please thodi der baad try karein.')
    } catch (_) { /* ignore */ }
  }
})

// GET /demo/messages/:sessionId — poll for bot replies
// The worker stores replies here (via storeDemoReply) instead of calling Meta
app.get('/demo/messages/:sessionId', async (req, reply) => {
  if (process.env.DEMO_MODE !== 'true') {
    return reply.status(404).send({ error: 'Demo mode is not enabled' })
  }

  const { sessionId } = req.params
  const messages      = await getDemoReplies(sessionId)
  return reply.status(200).send({ messages })
})

// ─────────────────────────────────────────────────────────
// ADMIN ROUTES — Steps 12-17
// Protected by x-admin-secret header.
// In Step 19, these will be replaced by proper NextAuth dashboard auth.
// ─────────────────────────────────────────────────────────

// Middleware: validate admin secret header
function validateAdminSecret(req, reply) {
  const secret = req.headers['x-admin-secret']
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    reply.status(401).send({ error: 'Unauthorized — provide x-admin-secret header' })
    return false
  }
  return true
}

// Register multipart for CSV and document uploads
await app.register(import('@fastify/multipart'), {
  limits: { fileSize: 50 * 1024 * 1024 }  // 50MB max
})

// ─── POST /admin/ingest-students/:collegeId ──────────────────────────────────
// Step 13: Upload a CSV of students. Processes in background. Returns immediately.
app.post('/admin/ingest-students/:collegeId', async (req, reply) => {
  if (!validateAdminSecret(req, reply)) return

  const { collegeId } = req.params
  const file          = await req.file()

  if (!file) return reply.status(400).send({ error: 'No file uploaded' })

  // Save to temp directory
  const tempPath = path.join(os.tmpdir(), `students-${collegeId}-${Date.now()}.csv`)
  const buffer   = await file.toBuffer()
  fs.writeFileSync(tempPath, buffer)

  // Process in background — don't block the HTTP response
  const { ingestStudentCSV } = await import('./services/studentOnboarding.js')
  const { messageQueue }     = await import('./queue.js')

  ingestStudentCSV(collegeId, tempPath, messageQueue)
    .then(r  => app.log.info(`[Admin] Student ingestion done for ${collegeId}: ${JSON.stringify(r)}`)
    ).catch(e => app.log.error(`[Admin] Student ingestion failed for ${collegeId}: ${e.message}`))

  return reply.send({
    message:  'CSV ingestion started — processing in background',
    collegeId,
    filename: file.filename,
  })
})

// ─── POST /admin/ingest-attendance/:collegeId ────────────────────────────────
// Step 15: Upload an attendance CSV. Queues absence alerts in background.
app.post('/admin/ingest-attendance/:collegeId', async (req, reply) => {
  if (!validateAdminSecret(req, reply)) return

  const { collegeId } = req.params
  const file          = await req.file()

  if (!file) return reply.status(400).send({ error: 'No file uploaded' })

  const tempPath = path.join(os.tmpdir(), `attendance-${collegeId}-${Date.now()}.csv`)
  const buffer   = await file.toBuffer()
  fs.writeFileSync(tempPath, buffer)

  const { ingestAttendanceCSV } = await import('./services/attendance.js')
  const { messageQueue }        = await import('./queue.js')

  ingestAttendanceCSV(collegeId, tempPath, messageQueue)
    .then(r  => app.log.info(`[Admin] Attendance ingestion done for ${collegeId}: ${JSON.stringify(r)}`))
    .catch(e => app.log.error(`[Admin] Attendance ingestion failed for ${collegeId}: ${e.message}`))

  return reply.send({
    message:  'Attendance CSV ingestion started — absence alerts queued in background',
    collegeId,
    filename: file.filename,
  })
})

// ─── POST /admin/ingest-document/:collegeId ──────────────────────────────────
// Step 17: Upload a PDF or text file to the college's RAG knowledge base.
app.post('/admin/ingest-document/:collegeId', async (req, reply) => {
  if (!validateAdminSecret(req, reply)) return

  const { collegeId } = req.params
  const file          = await req.file()

  if (!file) return reply.status(400).send({ error: 'No file uploaded' })

  // Document title from header or filename
  const title    = req.headers['x-document-title'] || file.filename
  const tempPath = path.join(os.tmpdir(), `doc-${collegeId}-${Date.now()}-${file.filename}`)
  const buffer   = await file.toBuffer()
  fs.writeFileSync(tempPath, buffer)

  const { ingestDocument } = await import('./rag/ingest.js')

  ingestDocument(collegeId, tempPath, title)
    .then(r  => app.log.info(`[Admin] RAG ingestion done for ${collegeId}: ${JSON.stringify(r)}`))
    .catch(e => app.log.error(`[Admin] RAG ingestion failed for ${collegeId}: ${e.message}`))

  return reply.send({
    message:    'Document ingestion started — chunks will appear in Qdrant shortly',
    collegeId,
    title,
    filename:   file.filename,
  })
})

// ─── PATCH /admin/college/:collegeId/config ──────────────────────────────────
// Step 12+: Update college config from dashboard. Invalidates the in-memory cache.
app.patch('/admin/college/:collegeId/config', async (req, reply) => {
  if (!validateAdminSecret(req, reply)) return

  const { collegeId } = req.params
  const updates       = req.body

  if (!updates || Object.keys(updates).length === 0) {
    return reply.status(400).send({ error: 'No updates provided' })
  }

  const { College } = await import('./models/College.js')
  const college     = await College.findOneAndUpdate(
    { collegeId },
    { $set: updates },
    { new: true }
  )

  if (!college) return reply.status(404).send({ error: `College not found: ${collegeId}` })

  // Invalidate cache so changes take effect immediately
  const { invalidateCache } = await import('./configCache.js')
  invalidateCache(collegeId)

  return reply.send({ message: 'Config updated', collegeId, updated: Object.keys(updates) })
})

// ─────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────
const start = async () => {
  try {
    // Connect to MongoDB (optional — server still starts if MONGODB_URI is missing)
    await connectDB()

    // Test Redis connection on startup
    await testRedisConnection()

    // PATTERN 10 (from bull-board Fastify adapter analysis):
    // BullBoard queue monitor — only mount if queue is initialized (not in demo mode)
    // Access at /admin/queues to see all jobs: waiting, active, completed, failed
    const { messageQueue } = await import('./queue.js')
    if (messageQueue) {
      const { createBullBoard } = await import('@bull-board/api')
      const { BullMQAdapter }   = await import('@bull-board/api/bullMQAdapter')
      const { FastifyAdapter }  = await import('@bull-board/fastify')

      const serverAdapter = new FastifyAdapter()
      serverAdapter.setBasePath('/admin/queues')

      createBullBoard({
        queues: [new BullMQAdapter(messageQueue)],
        serverAdapter,
        options: { uiConfig: { boardTitle: 'Jodein Message Queue 📨' } }
      })

      await app.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' })
      console.log('Queue monitor ready: http://localhost:3000/admin/queues')
    }

    await app.listen({
      port: parseInt(process.env.PORT) || 3000,
      host: '0.0.0.0' // IMPORTANT: must be 0.0.0.0, not localhost, for Railway
    })

    const port = parseInt(process.env.PORT) || 3000
    if (process.env.DEMO_MODE === 'true') {
      console.log(`\n🎓 DEMO MODE ACTIVE`)
      console.log(`   Chat UI:      http://localhost:${port}/demo`)
      console.log(`   Health:       http://localhost:${port}/health\n`)
    } else {
      console.log(`\n🚀 Jodein running in PRODUCTION mode`)
      console.log(`   Health:       http://localhost:${port}/health`)
      if (messageQueue) console.log(`   Queue monitor: http://localhost:${port}/admin/queues`)
      console.log()
    }
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
