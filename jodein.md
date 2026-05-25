# Jodein — Complete Build Guide: Steps 1 to 10

> Written for someone building this for the first time. Every command, every file, every reason explained.

---

## Before You Start — Install These Once

```bash
# Node.js (use v20 LTS)
# Download from: https://nodejs.org/en/download

# Verify installation
node --version   # should print v20.x.x
npm --version    # should print 10.x.x

# Install pnpm (faster than npm)
npm install -g pnpm

# Install Railway CLI (for deployment)
npm install -g @railway/cli

# Verify Railway
railway --version
```

---

## Your Folder Structure (Before You Write Any Code)

```
jodein/
├── src/
│   ├── server.js          ← Fastify HTTP server (webhook lives here)
│   ├── worker.js          ← BullMQ worker (LLM calls happen here)
│   ├── queue.js           ← Queue definition (shared between server + worker)
│   ├── whatsapp.js        ← All Meta API calls
│   ├── ai.js              ← Gemini Flash integration
│   └── redis.js           ← Upstash Redis client
├── .env                   ← All secrets (never commit this)
├── .env.example           ← Template for others (commit this)
├── .gitignore
├── package.json
└── railway.toml           ← Railway deployment config
```

---

---

# STEP 1 — Create Your Meta Developer Account and Get Your Test Number

## What you are doing and why
Meta controls WhatsApp. To send or receive WhatsApp messages from code, you need
Meta's official permission via their Cloud API. This step gets you that permission
and a test phone number you can use for free while building.

## Exact actions

### 1.1 — Create a Meta Developer account
1. Go to: https://developers.facebook.com
2. Click "Get Started" in the top right
3. Log in with any personal Facebook account (or create one)
4. Accept the developer terms

### 1.2 — Create a new App
1. Click "Create App" on the dashboard
2. Choose app type: **Business**
3. App name: `Jodein Dev` (this is internal, users never see it)
4. App contact email: your email
5. Business portfolio: leave blank for now, click "Create app"

### 1.3 — Add the WhatsApp product
1. You land on the App Dashboard. Scroll down to find "Add products to your app"
2. Find "WhatsApp" and click "Set up"
3. You now see the WhatsApp Getting Started page

### 1.4 — Collect your credentials
On the WhatsApp Getting Started page, you will see a panel called
"Send and receive messages." Note down these three values:

```
Phone Number ID:              (looks like: 123456789012345)
WhatsApp Business Account ID: (looks like: 987654321098765)
Temporary access token:       (a very long string starting with EAA...)
```

> IMPORTANT: The temporary access token expires in 24 hours.
> You will create a permanent one in Step 2.5. For now, use this one.

### 1.5 — Understand the test number
Meta gives you a free test number. You can message it from up to 5 real WhatsApp
numbers that you manually add as "recipients." This is enough for building.

To add your own phone as a recipient:
1. On the Getting Started page, scroll to "To"
2. Click the dropdown, select "Manage phone number list"
3. Add your WhatsApp number in +91XXXXXXXXXX format
4. WhatsApp will send you a code — enter it to verify

## What can go wrong
- "Business portfolio required": Create a free Meta Business account at
  business.facebook.com first, then come back and link it
- "App in Development mode": This is fine. Your 5 test recipients can still
  message the test number. You only need to go Live for production.

## Resources
- Meta WhatsApp Setup Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
- Video walkthrough: https://www.youtube.com/watch?v=V28iU6TTCWQ

---

---

# STEP 2 — Create Your Node.js Project and Deploy to Railway

## What you are doing and why
You need a server on the public internet so Meta can send messages to it.
Your laptop is not publicly accessible. Railway gives you a free public URL
in minutes.

## 2.1 — Initialize the project

```bash
# Create project folder
mkdir jodein
cd jodein

# Initialize Node.js project
pnpm init

# Install core dependencies
pnpm add fastify @fastify/env dotenv

# Create the folder structure
mkdir src
touch src/server.js src/worker.js src/queue.js src/whatsapp.js src/ai.js src/redis.js
touch .env .env.example .gitignore railway.toml
```

## 2.2 — Write the .gitignore

```
# .gitignore
node_modules/
.env
*.log
dist/
```

## 2.3 — Write the .env.example

```bash
# .env.example — copy this to .env and fill in real values

# Meta / WhatsApp
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_ACCESS_TOKEN=your_access_token_here
WEBHOOK_VERIFY_TOKEN=any_random_string_you_choose   # e.g. jodein_secret_2024

# Upstash Redis (fill in Step 5)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Google AI (fill in Step 6)
GOOGLE_AI_API_KEY=

# Server
PORT=3000
```

## 2.4 — Fill in your .env with real values from Step 1

```bash
# .env
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxx...
WEBHOOK_VERIFY_TOKEN=jodein_secret_2024
PORT=3000
```

## 2.5 — Create a permanent access token (do this now, not later)

The temporary token from Step 1.4 expires in 24 hours. Here is how to
create a permanent system user token:

1. Go to: https://business.facebook.com/settings
2. Left sidebar → Users → System Users
3. Click "Add" → Name it "Jodein Bot" → Role: Admin
4. Click "Generate New Token"
5. Select your app from the dropdown
6. Check permissions: `whatsapp_business_messaging`, `whatsapp_business_management`
7. Click Generate → Copy the token
8. Replace `WHATSAPP_ACCESS_TOKEN` in your .env with this permanent token

## 2.6 — Write the basic Fastify server

```javascript
// src/server.js
import Fastify from 'fastify'
import { config } from 'dotenv'

config() // loads .env file

const app = Fastify({
  logger: true // prints logs to console — useful while building
})

// Health check — Railway uses this to know your server is alive
app.get('/health', async (req, reply) => {
  return { status: 'ok', service: 'jodein' }
})

// Placeholder webhook route — we build this properly in Step 3
app.get('/webhook/:collegeId', async (req, reply) => {
  return { message: 'webhook get — to be implemented' }
})

app.post('/webhook/:collegeId', async (req, reply) => {
  return { message: 'webhook post — to be implemented' }
})

// Start server
const start = async () => {
  try {
    await app.listen({
      port: parseInt(process.env.PORT) || 3000,
      host: '0.0.0.0' // IMPORTANT: must be 0.0.0.0, not localhost, for Railway
    })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
```

## 2.7 — Update package.json

```json
{
  "name": "jodein",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js"
  }
}
```

## 2.8 — Create railway.toml

```toml
# railway.toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "node src/server.js"
healthcheckPath = "/health"
healthcheckTimeout = 30
```

## 2.9 — Deploy to Railway

```bash
# Login to Railway
railway login

# Initialize Railway project (run from inside jodein/ folder)
railway init

# When prompted: create new project, name it "jodein"

# Deploy
railway up

# Get your public URL
railway open
# This opens your Railway dashboard — copy the public URL
# It looks like: https://jodein-production-abc123.up.railway.app
```

## 2.10 — Verify deployment

Open your browser and go to:
`https://your-railway-url.up.railway.app/health`

You should see: `{"status":"ok","service":"jodein"}`

If you see this, your server is live on the internet. Step 2 complete.

## What can go wrong
- "Cannot find module": Make sure `"type": "module"` is in package.json
- "Port already in use": Railway assigns the PORT automatically — make sure
  you are reading `process.env.PORT`, not hardcoding 3000
- Server not starting: Check Railway logs with `railway logs`

## Resources
- Fastify docs: https://fastify.dev/docs/latest/
- Fastify GitHub: https://github.com/fastify/fastify (80k stars)
- Railway docs: https://docs.railway.app
- Railway Node.js starter: https://github.com/railwayapp-templates/nodejs

---

---

# STEP 3 — Build the Webhook Verification Handshake

## What you are doing and why
When you tell Meta "my webhook URL is X," Meta immediately sends a GET request
to that URL with a challenge. If you respond correctly, Meta knows you own that URL
and will start forwarding WhatsApp messages to it. This is a one-time handshake.

## How the handshake works

```
Meta sends GET /webhook/testcollege with query params:
  hub.mode         = "subscribe"
  hub.challenge    = "1234567890"   (a random number Meta picks)
  hub.verify_token = "jodein_secret_2024"  (the token YOU set in Meta dashboard)

Your server must:
  1. Check that hub.verify_token matches your WEBHOOK_VERIFY_TOKEN env var
  2. Check that hub.mode === "subscribe"
  3. If both match: respond with the exact hub.challenge value (just the number)
  4. If either doesn't match: respond with 403 Forbidden
```

## 3.1 — Update server.js with real webhook verification

```javascript
// src/server.js
import Fastify from 'fastify'
import { config } from 'dotenv'

config()

const app = Fastify({ logger: true })

app.get('/health', async (req, reply) => {
  return { status: 'ok', service: 'jodein' }
})

// STEP 3: Webhook verification (GET request from Meta)
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

// Placeholder for POST (Step 4)
app.post('/webhook/:collegeId', async (req, reply) => {
  app.log.info('Received POST webhook:', JSON.stringify(req.body, null, 2))
  // ALWAYS return 200 immediately — Meta will retry if you don't
  return reply.status(200).send('OK')
})

const start = async () => {
  try {
    await app.listen({ port: parseInt(process.env.PORT) || 3000, host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
```

## 3.2 — Deploy the updated code

```bash
railway up
```

## 3.3 — Register your webhook URL with Meta

1. Go to your Meta App Dashboard
2. Left sidebar → WhatsApp → Configuration
3. Under "Webhook", click "Edit"
4. Callback URL: `https://your-railway-url.up.railway.app/webhook/testcollege`
5. Verify token: `jodein_secret_2024` (exactly what you put in WEBHOOK_VERIFY_TOKEN)
6. Click "Verify and Save"

If Meta shows a green checkmark, your webhook is verified. Step 3 complete.

## 3.4 — Subscribe to message events

After verifying, you need to tell Meta which events to send you:
1. Still on the Webhook configuration page
2. Click "Manage" next to webhook fields
3. Check "messages" — this is the main one you need
4. Also check "message_deliveries" and "message_reads" (useful later)
5. Click Done

## What can go wrong
- "Verification failed": Make sure WEBHOOK_VERIFY_TOKEN in your .env matches
  exactly what you typed in the Meta dashboard. Case sensitive.
- "URL not reachable": Your Railway deployment must be live. Check `/health` first.
- "Challenge not received": Make sure you are returning ONLY the challenge string,
  not a JSON object like `{ challenge: "1234" }` — Meta expects the raw number.

## Resources
- Meta Webhook Setup: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks
- Webhook troubleshooting: https://developers.facebook.com/docs/graph-api/webhooks/troubleshooting

---

---

# STEP 4 — Receive a Message and Log It

## What you are doing and why
Every time someone sends a WhatsApp message to your test number, Meta sends a POST
request to your webhook. Before you reply intelligently, you need to understand the
exact shape of that incoming data and confirm you can receive it.

## 4.1 — Understand the incoming payload structure

When a user sends "hello", Meta sends your server this JSON:

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "15550001234",
              "phone_number_id": "123456789012345"
            },
            "contacts": [
              {
                "profile": { "name": "Rahul Kumar" },
                "wa_id": "919876543210"
              }
            ],
            "messages": [
              {
                "from": "919876543210",
                "id": "wamid.XXXXXXXXXXXXXXXXXX",
                "timestamp": "1700000000",
                "text": { "body": "hello" },
                "type": "text"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

Key fields you need:
- `entry[0].changes[0].value.messages[0].from` → sender's phone number
- `entry[0].changes[0].value.messages[0].text.body` → the actual message text
- `entry[0].changes[0].value.messages[0].id` → unique message ID (for dedup later)
- `entry[0].changes[0].value.messages[0].type` → "text", "image", "audio", etc.

## 4.2 — Write a message parser utility

```javascript
// src/whatsapp.js
import { config } from 'dotenv'
config()

// Parse the raw webhook payload into a clean object
export function parseIncomingMessage(body) {
  try {
    const entry   = body?.entry?.[0]
    const change  = entry?.changes?.[0]
    const value   = change?.value
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
```

## 4.3 — Update the webhook POST handler to use the parser

```javascript
// Add to src/server.js — replace the placeholder POST handler

import { parseIncomingMessage } from './whatsapp.js'

app.post('/webhook/:collegeId', async (req, reply) => {
  const { collegeId } = req.params

  // ALWAYS return 200 immediately
  // If you delay this, Meta thinks your server is broken and retries
  reply.status(200).send('OK')

  // Parse the message (do this AFTER sending 200)
  const parsed = parseIncomingMessage(req.body)

  if (!parsed) {
    // Could be a delivery receipt, read receipt, or unsupported type
    return
  }

  // LOG EVERYTHING while building — you'll remove this later
  console.log('=== INCOMING MESSAGE ===')
  console.log('College:   ', collegeId)
  console.log('From:      ', parsed.from)
  console.log('Name:      ', parsed.name)
  console.log('Message:   ', parsed.text)
  console.log('Message ID:', parsed.messageId)
  console.log('========================')

  // Step 5 onwards: we will process this message and reply
})
```

## 4.4 — Test it

1. Deploy: `railway up`
2. Send a WhatsApp message to your Meta test number from your phone
3. Check Railway logs: `railway logs`
4. You should see your `=== INCOMING MESSAGE ===` block with your message

If you see your own WhatsApp message printed in the Railway logs, Step 4 is complete.
Your server is now receiving real WhatsApp messages from the internet.

## What can go wrong
- "Logs show nothing": Make sure you subscribed to "messages" in Step 3.4
- "Object is undefined": The payload shape sometimes varies — use optional chaining
  (`?.`) everywhere as shown above
- "Meta keeps retrying": This means you are not returning 200 fast enough.
  The `reply.status(200).send('OK')` line MUST come before any async processing.

## Resources
- Meta message payload reference: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
- GitHub example (official Meta): https://github.com/fbsamples/whatsapp-api-examples/tree/main/basic-webhook-js

---

---

# STEP 5 — Connect Upstash Redis and Store Conversation History

## What you are doing and why
An LLM has no memory. Every time a student sends a message, you need to send
the last N messages as context so the bot can have a real conversation rather
than treating every message as the first one.

Redis is an in-memory database — extremely fast for storing and retrieving
small objects like conversation history. Upstash is Redis with a serverless
billing model (you pay per request, not per hour), which costs essentially
nothing while building.

## 5.1 — Create an Upstash account and database

1. Go to: https://upstash.com
2. Sign up for free
3. Click "Create Database"
4. Name: `jodein-redis`
5. Region: Choose `ap-south-1` (Mumbai) for lowest latency in India
6. Type: Regional (not Global — cheaper for now)
7. Click Create

8. On the database page, find "REST API" section
9. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
10. Paste both into your `.env` file

## 5.2 — Install the Upstash Redis client

```bash
pnpm add @upstash/redis
```

## 5.3 — Write the Redis client

```javascript
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
  try {
    await redis.set('connection_test', 'ok')
    const val = await redis.get('connection_test')
    console.log('Redis connected:', val === 'ok' ? 'SUCCESS' : 'FAIL')
  } catch (err) {
    console.error('Redis connection failed:', err.message)
  }
}
```

## 5.4 — Write conversation history functions

```javascript
// Add to src/redis.js

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
```

## 5.5 — Add Redis env vars to Railway

```bash
# Railway needs to know about your env vars
railway variables set UPSTASH_REDIS_REST_URL="https://..."
railway variables set UPSTASH_REDIS_REST_TOKEN="your_token_here"
```

## 5.6 — Test locally first

```javascript
// Temporary test — add to server.js startup, remove after testing
import { testRedisConnection } from './redis.js'

// Inside the start() function, add:
await testRedisConnection()
```

Run locally: `pnpm dev`
You should see: `Redis connected: SUCCESS`

## What can go wrong
- "ERR wrong number of arguments": Make sure you are passing both URL and token
- "Connection refused": Make sure you are using the REST URL (starts with https://),
  not the Redis connection string (starts with rediss://)
- History not persisting: Check that TTL is set — if you don't set `ex: 86400`,
  the key never expires and also won't show up in some Upstash free tier dashboards

## Resources
- Upstash Redis docs: https://docs.upstash.com/redis
- @upstash/redis GitHub: https://github.com/upstash/upstash-redis (2k stars)
- Upstash free tier: 10,000 requests/day free — more than enough while building

---

---

# STEP 6 — Connect Gemini Flash and Generate a Reply

## What you are doing and why
This is where the intelligence enters. Gemini Flash is Google's fastest LLM —
it responds in under 1 second on average, costs almost nothing, and handles
Hindi/Hinglish natively. We connect it here and pass the conversation history
so it can give contextual answers.

## 6.1 — Get a Google AI API key

1. Go to: https://aistudio.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Select "Create API key in new project"
5. Copy the key (starts with `AIza...`)
6. Add to .env: `GOOGLE_AI_API_KEY=AIzaXXXXXXXX`

Free tier: 15 requests/minute, 1 million tokens/day — more than enough.

## 6.2 — Install the Google AI SDK

```bash
pnpm add @google/generative-ai
```

## 6.3 — Write the AI module

```javascript
// src/ai.js
import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from 'dotenv'
config()

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)

// We use Gemini Flash — the fastest and cheapest model
// gemini-1.5-flash-latest = always uses the latest Flash version
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' })

// The system prompt defines the bot's personality and knowledge scope
// This will eventually be loaded from MongoDB per college
// For now, use a default
const DEFAULT_SYSTEM_PROMPT = `
You are Jodein, the campus assistant for this institution.
You help students with information about their academic life.

Rules:
- Answer only questions related to academics, campus, attendance, exams, and college life
- If you don't have specific information, say clearly: "Mujhe is baare mein specific information nahi hai — please apne department se confirm karein"
- Keep answers concise — WhatsApp is not an essay platform
- Respond in the same language the student uses (Hindi, English, or Hinglish)
- Never make up course content, exam dates, or attendance data
- Be warm and friendly — like a helpful senior student, not a formal robot
`.trim()

// Main function: takes history array and new message, returns AI reply
export async function generateReply(history, newMessage, systemPrompt = DEFAULT_SYSTEM_PROMPT) {
  try {
    // Build the conversation in the format Gemini expects
    // Gemini uses { role: "user"/"model", parts: [{ text: "..." }] }
    // Note: Gemini uses "model" not "assistant" — we convert here
    const formattedHistory = history.map(msg => ({
      role:  msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }))

    // Start a chat session with history
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: {
        maxOutputTokens: 500,    // keep replies short for WhatsApp
        temperature:     0.7,    // 0 = robotic, 1 = creative. 0.7 is balanced
      },
      systemInstruction: systemPrompt,
    })

    // Send the new message and get reply
    const result   = await chat.sendMessage(newMessage)
    const response = await result.response
    const text     = response.text()

    return text

  } catch (err) {
    console.error('Gemini error:', err.message)
    // Return a fallback message so the user isn't left hanging
    return 'Sorry, I am having trouble responding right now. Please try again in a moment.'
  }
}
```

## 6.4 — Test the AI module in isolation

Create a quick test file (delete after testing):

```javascript
// test-ai.js (temporary, delete after testing)
import { generateReply } from './src/ai.js'

const history = [
  { role: 'user',      content: 'Kya tum meri madad kar sakte ho?' },
  { role: 'assistant', content: 'Bilkul! Aap kya jaanna chahte hain?' }
]

const reply = await generateReply(history, 'Mera next semester mein kaunse subjects hain?')
console.log('AI Reply:', reply)
```

```bash
node test-ai.js
```

You should see a Hindi/Hinglish reply from Gemini. Delete the test file.

## What can go wrong
- "API key not valid": Double-check the key in .env. Make sure there are no spaces.
- "429 Resource exhausted": You hit the free rate limit. Wait 1 minute and retry.
- "Candidate was blocked": Gemini's safety filter blocked the message. This is rare
  for academic queries. If it keeps happening, check what's being sent.

## Resources
- Google AI SDK GitHub: https://github.com/google-gemini/generative-ai-js (2.5k stars)
- Gemini API docs: https://ai.google.dev/gemini-api/docs
- Model comparison (Flash vs Pro): https://ai.google.dev/gemini-api/docs/models/gemini

---

---

# STEP 7 — Send the Reply Back to WhatsApp

## What you are doing and why
You can now receive messages and generate intelligent replies. This step closes
the loop — sending that reply back to the user's WhatsApp number via the Meta API.

## 7.1 — Understand the Meta Send Message API

To send a message, you make a POST request to:
```
POST https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages
```

With these headers:
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

And this body for a text message:
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "text",
  "text": {
    "preview_url": false,
    "body": "Your reply text here"
  }
}
```

## 7.2 — Write the send message function

```javascript
// Add to src/whatsapp.js

// Send a text reply to a user
export async function sendTextMessage(toNumber, messageText) {
  const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

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
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
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
```

## 7.3 — Wire everything together in the webhook handler

Now update the POST webhook in server.js to use all three modules:

```javascript
// src/server.js — updated POST handler
import { parseIncomingMessage, sendTextMessage } from './whatsapp.js'
import { generateReply }                         from './ai.js'
import { getHistory, addToHistory }              from './redis.js'

app.post('/webhook/:collegeId', async (req, reply) => {
  const { collegeId } = req.params

  // ALWAYS return 200 immediately — before any async work
  reply.status(200).send('OK')

  // Parse message
  const parsed = parseIncomingMessage(req.body)
  if (!parsed) return

  console.log(`[${collegeId}] Message from ${parsed.name} (${parsed.from}): ${parsed.text}`)

  try {
    // Get conversation history from Redis
    const history = await getHistory(collegeId, parsed.from)

    // Generate reply using Gemini
    const reply = await generateReply(history, parsed.text)

    // Send reply back to WhatsApp
    await sendTextMessage(parsed.from, reply)

    // Save both user message and bot reply to history
    await addToHistory(collegeId, parsed.from, 'user',      parsed.text)
    await addToHistory(collegeId, parsed.from, 'assistant', reply)

  } catch (err) {
    console.error('Error processing message:', err)
    // Try to send an error message to the user
    await sendTextMessage(parsed.from, 'Sorry, something went wrong. Please try again.')
  }
})
```

## 7.4 — Deploy and test the full conversation loop

```bash
railway up
```

Now send a message from your WhatsApp to the test number.
Within 2–3 seconds, you should receive an intelligent reply.

Send a follow-up message — the bot should remember the previous message.

This is the core of Jodein working. Steps 1–7 = a working, conversational WhatsApp bot.

## What can go wrong
- "Invalid parameter: to": The phone number must be in E.164 format with country code
  but WITHOUT the + sign. So `+919876543210` becomes `919876543210`.
- "Message not delivered": Check that your own number is in the test recipients list
  (Step 1.5). Only added numbers can receive messages in Dev mode.
- "(#131030) Recipient phone not in allowed list": Same as above — add your number.

## Resources
- Meta Send Messages API: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
- Message object reference: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages#message-object

---

---

# STEP 8 — Add the Typing Indicator

## What you are doing and why
Gemini takes 0.5–2 seconds to respond. During that time, the user sees nothing
and wonders if the bot is working. A typing indicator (the three bouncing dots in
WhatsApp) makes the product feel instant and alive even before the reply arrives.
This is a 10-minute change that dramatically improves perceived quality.

## 8.1 — Write the typing indicator function

```javascript
// Add to src/whatsapp.js

// Show the "typing..." indicator in the user's WhatsApp chat
// Call this BEFORE making the LLM call
export async function sendTypingIndicator(toNumber, incomingMessageId) {
  const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`

  // To show typing, you mark the incoming message as "read"
  // WhatsApp automatically shows typing when a message is read but not yet replied to
  const body = {
    messaging_product: 'whatsapp',
    status:            'read',
    message_id:        incomingMessageId
  }

  try {
    await fetch(url, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body)
    })
    // No need to check response — typing indicator failure is non-critical
  } catch (err) {
    // Silently ignore — if typing indicator fails, reply still works
    console.warn('Could not send typing indicator:', err.message)
  }
}
```

## 8.2 — Update the webhook handler to use typing indicator

```javascript
// src/server.js — add typing indicator before LLM call

import { parseIncomingMessage, sendTextMessage, sendTypingIndicator } from './whatsapp.js'

// Inside the POST webhook handler, replace the processing block:

    // FIRST: show typing indicator immediately (user sees this in <100ms)
    await sendTypingIndicator(parsed.from, parsed.messageId)

    // THEN: get history
    const history = await getHistory(collegeId, parsed.from)

    // THEN: generate reply (this takes 0.5–2s, but user sees typing dots)
    const aiReply = await generateReply(history, parsed.text)

    // THEN: send the reply
    await sendTextMessage(parsed.from, aiReply)

    // THEN: save to history
    await addToHistory(collegeId, parsed.from, 'user',      parsed.text)
    await addToHistory(collegeId, parsed.from, 'assistant', aiReply)
```

## 8.3 — Deploy and test

```bash
railway up
```

Send a message. You should now see the typing dots appear almost immediately,
followed by the reply 1–2 seconds later. This is the experience that makes
the product feel premium.

## What can go wrong
- "Typing dots not showing": Some versions of WhatsApp handle this differently.
  The `status: read` approach is the officially supported method.
- Double blue ticks not appearing: This just means the "read" status went through.
  The typing visual may vary by WhatsApp version.

---

---

# STEP 9 — Add BullMQ Message Queue

## What you are doing and why
Right now your webhook is doing everything: receiving the message, calling Redis,
calling Gemini, sending the reply. This works for 1 user. For 100 simultaneous
users, your server will get slow. For 1,000 simultaneous messages, it will crash.

A message queue separates "receiving" from "processing":
- Webhook receives message → pushes to queue → returns 200 in 20ms
- Worker pulls from queue → processes at its own pace → no rush

This is the single most important architectural change for reliability.

## 9.1 — Install BullMQ

```bash
pnpm add bullmq
```

BullMQ uses Redis as its storage. You already have Upstash Redis from Step 5.
However, BullMQ requires a Redis connection using `ioredis` (traditional TCP),
not Upstash's REST API. For production, you'd use a separate Redis instance,
but for this step you can use a free Redis Cloud instance.

```bash
# Create a free Redis Cloud account: https://redis.com/try-free/
# Get the connection string: redis://:password@host:port
# Add to .env:
# BULLMQ_REDIS_URL=redis://:yourpassword@your-host.redis.cloud:12345
```

Alternatively, for local development, run Redis locally with Docker:
```bash
docker run -d -p 6379:6379 redis:alpine
# Then use: BULLMQ_REDIS_URL=redis://localhost:6379
```

## 9.2 — Write the queue definition

```javascript
// src/queue.js
import { Queue, Worker, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'
import { config } from 'dotenv'
config()

// Parse the Redis URL for BullMQ
const connection = new IORedis(process.env.BULLMQ_REDIS_URL, {
  maxRetriesPerRequest: null,  // required by BullMQ
  enableReadyCheck:     false, // required by BullMQ
})

// The queue — messages wait here to be processed
export const messageQueue = new Queue('incoming-messages', {
  connection,
  defaultJobOptions: {
    attempts:    3,             // retry failed jobs up to 3 times
    backoff: {
      type:  'exponential',
      delay: 1000               // wait 1s, then 2s, then 4s between retries
    },
    removeOnComplete: 100,      // keep last 100 completed jobs for debugging
    removeOnFail:     500       // keep last 500 failed jobs for investigation
  }
})

export { connection }

console.log('Message queue initialized')
```

## 9.3 — Write the worker

```javascript
// src/worker.js
import { Worker } from 'bullmq'
import { connection } from './queue.js'
import { sendTextMessage, sendTypingIndicator } from './whatsapp.js'
import { generateReply }                         from './ai.js'
import { getHistory, addToHistory }              from './redis.js'

console.log('Worker starting...')

const worker = new Worker(
  'incoming-messages',

  // This function runs for every job in the queue
  async (job) => {
    const { collegeId, parsed } = job.data

    console.log(`[Worker] Processing message from ${parsed.name} at ${collegeId}`)

    // Show typing indicator
    await sendTypingIndicator(parsed.from, parsed.messageId)

    // Get conversation history
    const history = await getHistory(collegeId, parsed.from)

    // Generate reply
    const aiReply = await generateReply(history, parsed.text)

    // Send reply
    await sendTextMessage(parsed.from, aiReply)

    // Save to history
    await addToHistory(collegeId, parsed.from, 'user',      parsed.text)
    await addToHistory(collegeId, parsed.from, 'assistant', aiReply)

    console.log(`[Worker] Done processing for ${parsed.from}`)
  },

  {
    connection,
    concurrency: 5,  // process up to 5 messages at the same time
  }
)

// Log when jobs complete or fail
worker.on('completed', job => {
  console.log(`[Worker] Job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job.id} failed:`, err.message)
})

worker.on('error', err => {
  console.error('[Worker] Worker error:', err)
})
```

## 9.4 — Update the webhook to use the queue (not process directly)

```javascript
// src/server.js — stripped-down webhook handler (fast!)
import { messageQueue } from './queue.js'
import { parseIncomingMessage } from './whatsapp.js'

app.post('/webhook/:collegeId', async (req, reply) => {
  const { collegeId } = req.params

  // Return 200 immediately — takes ~5ms
  reply.status(200).send('OK')

  // Parse message
  const parsed = parseIncomingMessage(req.body)
  if (!parsed) return

  // Push to queue — takes ~10ms
  // All the heavy work (Redis, Gemini, WhatsApp reply) happens in worker.js
  await messageQueue.add('process-message', { collegeId, parsed }, {
    jobId: parsed.messageId  // use WhatsApp message ID as job ID for deduplication
    // if the same message arrives twice (Meta retries), BullMQ will ignore the duplicate
  })

  console.log(`[Server] Message queued from ${parsed.from} — returning immediately`)
})
```

## 9.5 — Update railway.toml to run both server and worker

```toml
# railway.toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "node src/server.js"
healthcheckPath = "/health"
```

Deploy the server normally. For the worker, you need a second Railway service:
1. In Railway dashboard → click "New Service" → "GitHub Repo" (same repo)
2. In the new service settings → "Start Command": `node src/worker.js`
3. Add all env vars to the worker service as well

This way, server and worker run as separate processes — if one crashes, the other
keeps running.

## 9.6 — Deploy and test

```bash
railway up
```

Check Railway logs for both services. When you send a message:
- Server logs should show: "Message queued — returning immediately"
- Worker logs should show: "Processing message... Done processing"

The reply should still arrive, but now the server never blocks.

## What can go wrong
- "ioredis connection refused": Your Redis URL for BullMQ is wrong. Double-check format.
- "Cannot use same Redis for Upstash and BullMQ": Upstash REST API is not compatible
  with ioredis. Use a separate Redis instance for BullMQ (Redis Cloud free tier works).
- "Job stuck in waiting": Worker is not running or not connected to the right Redis.

## Resources
- BullMQ GitHub: https://github.com/taskforcesh/bullmq (16k stars)
- BullMQ docs: https://docs.bullmq.io
- BullMQ with Redis Cloud: https://docs.bullmq.io/guide/connections

---

---

# STEP 10 — Webhook Hardening: Signature Verification and Deduplication

## What you are doing and why
Right now your webhook accepts requests from anyone on the internet. Someone
could spam your server with fake messages. Meta signs every webhook request
with a secret key — you need to verify this signature before processing anything.

Also, Meta sometimes sends the same message twice (network retries). Without
deduplication, your bot sends double replies. This looks broken to users.

## 10.1 — Understand Meta's webhook signature

Meta includes this header on every POST request:
```
X-Hub-Signature-256: sha256=abc123...
```

This is an HMAC-SHA256 hash of the raw request body, signed with your
app's secret key. You can verify it to confirm the request is genuinely from Meta.

## 10.2 — Get your App Secret

1. Go to Meta App Dashboard
2. App Settings → Basic
3. Find "App Secret" → click Show
4. Copy it → add to .env: `META_APP_SECRET=your_secret_here`

## 10.3 — Write the signature verification function

```javascript
// Add to src/whatsapp.js
import crypto from 'crypto'

export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader) {
    console.warn('No signature header — rejecting request')
    return false
  }

  // Header format: "sha256=abc123..."
  const [algorithm, signature] = signatureHeader.split('=')

  if (algorithm !== 'sha256') {
    console.warn('Unexpected signature algorithm:', algorithm)
    return false
  }

  // Compute expected signature using your app secret
  const expectedSignature = crypto
    .createHmac('sha256', process.env.META_APP_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex')

  // Use timingSafeEqual to prevent timing attacks
  const signatureBuffer = Buffer.from(signature,          'hex')
  const expectedBuffer  = Buffer.from(expectedSignature,  'hex')

  if (signatureBuffer.length !== expectedBuffer.length) return false

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
}
```

## 10.4 — Add deduplication using Redis

```javascript
// Add to src/redis.js

// Deduplication: check if we've already processed a message
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
```

## 10.5 — Update the webhook handler with both protections

```javascript
// src/server.js — final hardened webhook handler
import crypto from 'crypto'
import { verifyWebhookSignature }                from './whatsapp.js'
import { isMessageProcessed, markMessageProcessed } from './redis.js'
import { messageQueue }                           from './queue.js'
import { parseIncomingMessage }                   from './whatsapp.js'

// IMPORTANT: You need the raw body bytes for signature verification
// Add this Fastify plugin to get the raw body
import fastifyRawBody from 'fastify-raw-body'
await app.register(fastifyRawBody, { field: 'rawBody', global: false, encoding: 'utf8' })

app.post('/webhook/:collegeId', {
  config: { rawBody: true }  // enable raw body for this route
}, async (req, reply) => {
  const { collegeId } = req.params

  // STEP 1: Verify the request is genuinely from Meta
  const signatureHeader = req.headers['x-hub-signature-256']
  const isValid         = verifyWebhookSignature(req.rawBody, signatureHeader)

  if (!isValid) {
    console.warn('INVALID SIGNATURE — rejecting request from:', req.ip)
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
    console.log(`Duplicate message ${parsed.messageId} — skipping`)
    return
  }

  // Mark as processed BEFORE queuing (prevents race conditions)
  await markMessageProcessed(parsed.messageId)

  // Push to queue
  await messageQueue.add('process-message', { collegeId, parsed }, {
    jobId: parsed.messageId
  })

  console.log(`[Server] Verified + queued message ${parsed.messageId}`)
})
```

## 10.6 — Install fastify-raw-body

```bash
pnpm add fastify-raw-body
```

## 10.7 — Add Meta App Secret to Railway

```bash
railway variables set META_APP_SECRET="your_app_secret"
```

## 10.8 — Final deploy

```bash
railway up
```

Test by sending messages. Everything should work exactly as before,
but now:
- Fake requests from non-Meta sources are rejected
- Duplicate messages never get processed twice
- Your bot cannot be abused by external parties

Step 10 complete. You now have a production-grade WhatsApp bot foundation.

---

---

# All Open Source Resources in One Place

## Core Libraries (install these)

| Library | Purpose | Install | GitHub |
|---|---|---|---|
| fastify | HTTP server | `pnpm add fastify` | github.com/fastify/fastify |
| @upstash/redis | Redis client (serverless) | `pnpm add @upstash/redis` | github.com/upstash/upstash-redis |
| @google/generative-ai | Gemini LLM | `pnpm add @google/generative-ai` | github.com/google-gemini/generative-ai-js |
| bullmq | Message queue | `pnpm add bullmq` | github.com/taskforcesh/bullmq |
| ioredis | Redis client (for BullMQ) | `pnpm add ioredis` | github.com/luin/ioredis |
| fastify-raw-body | Raw body for signature check | `pnpm add fastify-raw-body` | github.com/Eomm/fastify-raw-body |
| dotenv | Environment variables | `pnpm add dotenv` | github.com/motdotla/dotenv |

## Platform Accounts to Create (all free)

| Platform | Purpose | URL |
|---|---|---|
| Meta for Developers | WhatsApp API access | developers.facebook.com |
| Railway | Server hosting | railway.app |
| Upstash | Serverless Redis | upstash.com |
| Redis Cloud | BullMQ Redis | redis.com/try-free |
| Google AI Studio | Gemini API key | aistudio.google.com |
| Pinecone | Vector DB for RAG (Step 6 onwards) | pinecone.io |
| Sentry | Error tracking | sentry.io |

## Reference Codebases to Study

| Repo | What to Learn | URL |
|---|---|---|
| whatsapp-api-examples (Meta official) | Webhook structure, payload shapes | github.com/fbsamples/whatsapp-api-examples |
| basic-webhook-js | Minimal working webhook | github.com/fbsamples/whatsapp-api-examples/tree/main/basic-webhook-js |
| evolution-api | Multi-instance WhatsApp gateway architecture | github.com/EvolutionAPI/evolution-api |
| chatwoot | Multi-tenant inbox, how webhooks route per account | github.com/chatwoot/chatwoot |
| whatomate | Multi-tenant bot management, closest to Jodein | github.com/whatomate |
| flowise | Visual RAG pipeline builder — study for later | github.com/FlowiseAI/Flowise |
| bullmq examples | Queue + Worker patterns | github.com/taskforcesh/bullmq/tree/master/examples |
| langchain-js | Agent + RAG patterns for Steps 11+ | github.com/langchain-ai/langchainjs |

## Documentation Pages (Bookmark These)

| Doc | URL |
|---|---|
| Meta WhatsApp Cloud API | developers.facebook.com/docs/whatsapp/cloud-api |
| Meta Webhook Setup | developers.facebook.com/docs/whatsapp/cloud-api/guides/set-up-webhooks |
| Meta Message Payloads | developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples |
| Meta Send Messages API | developers.facebook.com/docs/whatsapp/cloud-api/reference/messages |
| Fastify Docs | fastify.dev/docs/latest |
| BullMQ Docs | docs.bullmq.io |
| Upstash Redis Docs | docs.upstash.com/redis |
| Gemini API Docs | ai.google.dev/gemini-api/docs |
| Railway Docs | docs.railway.app |
| Pinecone Docs | docs.pinecone.io |

## Videos to Watch Before Starting

| Video | What it teaches | Search on YouTube |
|---|---|---|
| WhatsApp Cloud API Setup | Step 1-3 in video form | "WhatsApp Cloud API webhook Node.js 2024" |
| BullMQ Crash Course | Queue + Worker pattern | "BullMQ tutorial Node.js" |
| Gemini API with Node.js | LLM integration | "Google Gemini API JavaScript tutorial" |
| RAG with LangChain.js | Steps 21-24 (later) | "RAG LangChain JavaScript Pinecone 2024" |
| Railway Deployment | Deploy Node.js | "Railway app Node.js deployment" |

---

## What Steps 11–20 Look Like (for your planning)

```
Step 11: Multi-tenant config in MongoDB (each college gets own bot config)
Step 12: Worker reads collegeId → loads config → uses college's system prompt
Step 13: Student onboarding — CSV upload → send activation message to each student
Step 14: Student self-registration — type ID → bot verifies → saves phone mapping
Step 15: Attendance ERP connector — CSV ingestion + parent alert sender
Step 16: Attendance Worker — formats and sends parent notification
Step 17: RAG pipeline — upload PDF → chunk → embed → upsert to Pinecone
Step 18: Bot uses RAG — query → retrieve from Pinecone → LLM with context
Step 19: Admin dashboard — Next.js, Clerk auth, bot config UI
Step 20: Rate limiting + analytics logging per college
```

---

*Built for Jodein — Campus Intelligence on WhatsApp*
*Start with Step 1. Do not read ahead until each step is working.*
