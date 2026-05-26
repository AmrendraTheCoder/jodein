// src/routes/demo.js
// Decoupled demo page and inline chat routes (active in dev when DEMO_MODE=true).

import { getDemoReplies, getHistory, addToHistory, clearHistory } from '../redis.js'
import { generateReply } from '../ai.js'

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
</html>`;

export default async function demoRoutes(fastify, options) {
  
  // Guard: global preHandler to block access if demo mode is off in env
  fastify.addHook('preHandler', async (req, reply) => {
    if (process.env.DEMO_MODE !== 'true') {
      return reply.status(404).send('Demo mode is not enabled. Set DEMO_MODE=true in your .env to use this.')
    }
  })

  // ─── GET /demo ─────────────────────────────────────────────────────────────
  fastify.get('/', async (req, reply) => {
    return reply.type('text/html').send(DEMO_HTML)
  })

  // ─── POST /demo/chat ────────────────────────────────────────────────────────
  fastify.post('/chat', async (req, reply) => {
    const { message, sessionId, name } = req.body

    if (!message || !sessionId) {
      return reply.status(400).send({ error: 'message and sessionId are required' })
    }

    // Respond immediately so browser starts polling UI
    reply.status(200).send({ queued: true, sessionId })

    const collegeId = 'demo'

    try {
      const RESET_COMMANDS = ['reset', '/reset', 'start over', '/start', 'clear', '/clear', 'naya shuru']

      if (RESET_COMMANDS.includes(message.trim().toLowerCase())) {
        await clearHistory(collegeId, sessionId)
        const { sendTextMessage } = await import('../whatsapp.js')
        await sendTextMessage(
          sessionId,
          '\u2705 Conversation cleared! Fresh start kar lete hain.\n\nAap kya jaanna chahte hain? \uD83D\uDE0A'
        )
        fastify.log.info(`[Demo] History cleared for session ${sessionId}`)
        return
      }

      // Retrieve history
      const history = await getHistory(collegeId, sessionId)

      // Generate reply using Gemini Flash
      const aiReply = await generateReply(history, message)

      // Store in demo message queue
      const { sendTextMessage } = await import('../whatsapp.js')
      await sendTextMessage(sessionId, aiReply)

      // Save user/assistant turns in history
      await addToHistory(collegeId, sessionId, 'user',      message)
      await addToHistory(collegeId, sessionId, 'assistant', aiReply)

      fastify.log.info(`[Demo] Processed message for session ${sessionId}`)

    } catch (err) {
      fastify.log.error(`[Demo] Error processing message: ${err.message}`)
      try {
        const { storeDemoReply } = await import('../redis.js')
        await storeDemoReply(sessionId, 'Sorry, kuch problem aa gayi \uD83D\uDE4F Please thodi der baad try karein.')
      } catch (_) { /* ignore */ }
    }
  })

  // ─── GET /demo/messages/:sessionId ─────────────────────────────────────────
  fastify.get('/messages/:sessionId', async (req, reply) => {
    const { sessionId } = req.params
    const messages      = await getDemoReplies(sessionId)
    return reply.status(200).send({ messages })
  })
}
