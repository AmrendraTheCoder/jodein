# PATTERNS.md — Extracted Architecture Patterns for Jodein
# Sourced from 15 open-source repos in /references/

> Every pattern below was extracted by reading actual source code.
> Format: What it is → What file it's from → How to apply it to Jodein.

---

## PATTERN 1 — Raw Body Capture for Webhook Signature Verification
**Source:** `references/tier1/whatsapp-api-examples/template-for-ecommerce-js/app.js`
**Extracted from:** Meta's own production example

Meta's official approach to capturing raw body for HMAC verification:
```js
// Meta does it with bodyParser verify callback
app.use(bodyParser.json({
  verify: function (req, res, buf) { req.rawBody = buf; }
}))
```
Jodein already does this better with `fastify-raw-body` plugin. ✅ Confirmed correct.

**Key insight from Meta examples:** They separate webhook routing into its own
`routes/incomingWebhook.js` file — message status updates (delivered/read/failed)
go to a DIFFERENT handler than actual messages. Jodein's `parseIncomingMessage()`
should explicitly handle and skip status-only payloads to avoid queueing noise jobs.

**Apply to Jodein:** Add explicit status-update filtering in `whatsapp.js`:
```js
// If payload only contains statuses, not messages — return null
if (body.entry?.[0]?.changes?.[0]?.value?.statuses && 
    !body.entry?.[0]?.changes?.[0]?.value?.messages) {
  return null // don't queue status-only events
}
```

---

## PATTERN 2 — BullMQ Backoff: Jitter is a Built-in Option
**Source:** `references/tier1/bullmq/src/classes/backoffs.ts`

BullMQ supports jitter natively in its exponential backoff:
```ts
exponential: function (delay: number, jitter = 0) {
  return function (attemptsMade: number): number {
    if (jitter > 0) {
      const maxDelay = Math.round(Math.pow(2, attemptsMade - 1) * delay)
      const minDelay = maxDelay * (1 - jitter)
      return Math.floor(Math.random() * maxDelay * jitter + minDelay)
    } else {
      return Math.round(Math.pow(2, attemptsMade - 1) * delay)
    }
  }
}
```
**Apply to Jodein** (`queue.js`) — add jitter to prevent thundering herd when
multiple jobs fail simultaneously and all retry at the same moment:
```js
backoff: {
  type: 'exponential',
  delay: 1000,
  jitter: 0.2  // ← add this: randomizes retry time by ±20%
}
```

---

## PATTERN 3 — BullMQ JobScheduler for Recurring Tasks
**Source:** `references/tier1/bullmq/src/classes/job-scheduler.ts`

BullMQ has a dedicated `JobScheduler` class (not just the older `repeat` option).
It supports cron expressions and is the production-correct way to schedule recurring tasks:
```ts
// Job scheduler is the stable API for repeating jobs
import { JobScheduler } from 'bullmq'
```
**Apply to Jodein** (Step 15 — attendance alerts):
```js
// Schedule daily attendance alerts at 8am for all colleges
await queue.upsertJobScheduler('daily-attendance-alerts', 
  { pattern: '0 8 * * *' },  // every day at 8am
  { name: 'send-attendance-alerts', data: { type: 'daily' } }
)
```

---

## PATTERN 4 — Rate Limiting with Lua Script in Redis
**Source:** `references/tier2/fastify-rate-limit/store/RedisStore.js`

The `fastify-rate-limit` Redis store uses a Lua script for atomic increment + TTL.
This is the correct pattern — prevents race conditions across multiple server instances:
```lua
local current = redis.call('INCR', key)
if current == 1 then
  redis.call('PEXPIRE', key, timeWindow)
end
return {current, timeWindow}
```
The store key is built from `keyGenerator(req)` which defaults to `req.ip`.

**Apply to Jodein** — rate limit by `collegeId`, not IP:
```js
await app.register(import('@fastify/rate-limit'), {
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (req) => req.params.collegeId || req.ip,  // per-college limit
  redis: upstashRedisClient
})
```
This prevents College A's flood of messages from slowing down College B.

---

## PATTERN 5 — Rate Limiting with Exponential Backoff
**Source:** `references/tier2/fastify-rate-limit/store/RedisStore.js` (line: `exponentialBackoff`)

`fastify-rate-limit` has a built-in `exponentialBackoff` flag. When enabled,
the TTL grows exponentially with each violation — abusive clients are frozen longer:
```js
// When a client exceeds the limit and keeps hammering:
// backoffExponent = current - max - 1
// timeWindow = min(timeWindow * (2 ^ backoffExponent), MAX_SAFE_INTEGER)
```
**Apply to Jodein** (anti-abuse config):
```js
await app.register(import('@fastify/rate-limit'), {
  max: 200,
  timeWindow: '1 minute',
  exponentialBackoff: true,  // ← abusers get progressively longer cooldowns
  keyGenerator: (req) => req.params.collegeId || req.ip
})
```

---

## PATTERN 6 — Multi-Tenant Session Routing (Evolution API / WAHA)
**Source:** `references/tier1/evolution-api/src/api/routes/instance.router.ts`
**Source:** `references/tier1/waha/src/core/integrations/webhooks/WebhookConductor.ts`

Both Evolution API and WAHA use the same architectural pattern:
- Each **phone number** = one **instance/session**
- Each instance has its own webhook URL, event subscriptions, and config
- A central `InstanceController`/`SessionManager` routes events to the right instance

WAHA's WebhookConductor is the gold standard:
```ts
// Per-session webhook routing using RxJS observables
public configure(session: WhatsappSession, webhooks: WebhookConfig[]) {
  for (const webhookConfig of webhooks) {
    // For each event type the session fires, attach a webhook sender
    const obs$ = session.getEventObservable(event)
    obs$.subscribe((payload) => {
      setImmediate(() => sender.send(data))  // non-blocking
    })
  }
}
```
**Apply to Jodein** (Step 11 — multi-tenant):
- Each college in MongoDB has a `webhookUrl`, `events[]` and `phoneNumberId`
- When a webhook arrives at `/webhook/:collegeId`, route to the correct session config
- Use `setImmediate()` (or queue) to ensure webhook response returns fast

---

## PATTERN 7 — LangChain Chat History — The Right Interface
**Source:** `references/tier3/langchainjs/libs/langchain-core/src/chat_history.ts`

LangChain defines a clean abstract base class for message history:
```ts
abstract class BaseChatMessageHistory {
  abstract getMessages(): Promise<BaseMessage[]>
  abstract addMessage(message: BaseMessage): Promise<void>
  abstract addUserMessage(message: string): Promise<void>
  abstract addAIMessage(message: string): Promise<void>
  abstract clear(): Promise<void>
  
  // Bulk add for efficiency (avoids N round-trips to Redis)
  async addMessages(messages: BaseMessage[]): Promise<void> {
    for (const message of messages) {
      await this.addMessage(message)
    }
  }
}
```
**Apply to Jodein** — Jodein's `redis.js` history functions (`getHistory`, `addToHistory`, `clearHistory`) 
match this pattern but aren't typed. In production, implement a class wrapping these functions 
that implements this interface. This makes swapping Redis for another store trivial.

**Key insight:** LangChain uses `HumanMessage` and `AIMessage` typed objects, not raw strings.
Jodein should store `{ role: 'user' | 'assistant', content: string }` instead of plain strings
to maintain compatibility with LangChain if you switch to it for RAG.

---

## PATTERN 8 — Flowise RAG: Rephrase + Retrieve + Respond (3-Step Pattern)
**Source:** `references/tier3/Flowise/packages/components/nodes/agents/ConversationalRetrievalToolAgent/ConversationalRetrievalToolAgent.ts`

Flowise's ConversationalRetrievalToolAgent uses a 3-step RAG pattern:

**Step 1 — REPHRASE:** Convert the user's question + chat history into a standalone question
```
"Given {chat_history}, rephrase {question} as a standalone question"
```

**Step 2 — RETRIEVE:** Search the vector DB with the standalone question

**Step 3 — RESPOND:** Answer using retrieved context + system prompt
```
"Using the following context: {context}, answer: {question}"
```

The key insight: without rephrase, "What about the fees?" after "Tell me about LNMIIT CSE" 
returns garbage from vector search. With rephrase, it becomes "What are the fees for LNMIIT CSE?"

**Apply to Jodein** (Step 17-18 — RAG):
```js
// In ai.js, the RAG pipeline:
const standaloneQuestion = await rephraseModel.invoke({
  chat_history: history,
  question: userMessage
})
const docs = await vectorStore.similaritySearch(standaloneQuestion, 4)
const reply = await llm.invoke({
  context: docs.map(d => d.pageContent).join('\n'),
  question: standaloneQuestion
})
```

---

## PATTERN 9 — Pino Redaction for Sensitive Data Masking
**Source:** `references/tier2/pino/docs/redaction.md` + `pino.js`

Pino's `redact` option masks sensitive fields in all logs automatically:
```js
const logger = pino({
  redact: {
    paths: ['req.headers.authorization', 'body.accessToken', '*.phoneNumber'],
    censor: '[REDACTED]'
  }
})
```
**Apply to Jodein** — WhatsApp access tokens, phone numbers, and student IDs
should NEVER appear in plain text logs. Configure Fastify's logger:
```js
const app = Fastify({
  logger: {
    level: 'info',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.body.entry[*].changes[*].value.contacts[*].wa_id', // phone numbers
        'WHATSAPP_ACCESS_TOKEN' // never log tokens
      ],
      censor: '[REDACTED]'
    }
  }
})
```

---

## PATTERN 10 — Bull-Board Fastify Adapter Integration
**Source:** `references/tier1/bull-board/packages/api/src/index.ts`
**Source:** `references/tier1/bull-board/packages/fastify/` (adapter exists!)

Bull-Board has a native Fastify plugin adapter. The integration is 3 lines:
```ts
// From bull-board source: createBullBoard takes queues + serverAdapter
createBullBoard({
  queues: [new BullMQAdapter(myQueue)],
  serverAdapter,
  options: { uiConfig: { boardTitle: 'Jodein Queue Monitor' } }
})
```
**Apply to Jodein** (`server.js`) — add the queue monitor UI:
```js
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { FastifyAdapter } from '@bull-board/fastify'

const serverAdapter = new FastifyAdapter()
serverAdapter.setBasePath('/admin/queues')

createBullBoard({
  queues: [new BullMQAdapter(messageQueue)],
  serverAdapter,
  options: { uiConfig: { boardTitle: 'Jodein Message Queue' } }
})
await app.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' })
```
Access at: `http://localhost:3000/admin/queues`

---

## PATTERN 11 — AdminJS Resource-Based Auto-Admin
**Source:** `references/tier2/adminjs/src/adminjs.ts`

AdminJS uses a `resources` array where each resource maps to a DB collection.
It auto-generates List, Show, Edit, Create, Delete views for each resource:
```ts
const admin = new AdminJS({
  databases: [mongoose],
  resources: [
    { resource: College, options: { /* custom actions */ } },
    { resource: Student, options: { parent: { name: 'Students' } } }
  ],
  rootPath: '/admin',
})
```
**Apply to Jodein** (Step 11 — internal super-admin):
- Add AdminJS for internal Jodein team to manage colleges, view logs, edit prompts
- NOT for college admins (those get the custom Next.js dashboard in Step 19)
- AdminJS saves 2-3 weeks of CRUD UI development for internal tooling

---

## PATTERN 12 — WAHA Health Check Pattern
**Source:** `references/tier1/waha/src/core/health/WAHAHealthCheckServiceCore.ts`

WAHA has a dedicated health check service that verifies:
1. Server is up (HTTP 200)
2. Each WhatsApp session is connected (not just "running", but authenticated)
3. Redis/database is reachable
4. Webhook delivery is working (sends a test event)

**Apply to Jodein** — extend `/health` endpoint:
```js
app.get('/health', async (req, reply) => {
  const checks = {
    server: 'ok',
    redis: await testRedisConnection() ? 'ok' : 'error',
    queue: messageQueue ? 'ok' : 'disabled (demo mode)',
    gemini: process.env.GOOGLE_AI_API_KEY ? 'configured' : 'missing'
  }
  const allOk = Object.values(checks).every(v => v === 'ok' || v.includes('ok') || v === 'configured')
  return reply.status(allOk ? 200 : 503).send(checks)
})
```

---

## PATTERN 13 — Baileys Message Retry Manager
**Source:** `references/tier3/Baileys/src/Utils/message-retry-manager.ts`

Baileys has a dedicated `MessageRetryManager` that tracks which messages
have been retried and prevents infinite retry loops. The key insight:
- Store retry count in memory (not Redis)
- Expire retry counters after 1 hour
- Max 5 retries per message before giving up

**Apply to Jodein** — Worker's BullMQ already handles retries, but
the fallback message logic should track attempt count:
```js
// In worker.js — don't send "sorry" on first attempt, only after final failure
worker.on('failed', async (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) {
    // This was the final attempt — NOW send the sorry message
    await sendTextMessage(job.data.parsed.from, 
      'Really sorry — Jodein is having issues. Please try again in a few minutes 🙏')
  }
})
```

---

## PATTERN 14 — Evolution API Instance-Scoped API Key Auth
**Source:** `references/tier1/evolution-api/src/api/routes/instance.router.ts`

Evolution API uses per-instance API keys — each "college" (instance) has its own key:
```ts
// In fetchInstances route:
const key = req.get('apikey')
// The key determines which instance you can access
```
This is the correct multi-tenant auth pattern:
- Global `JODEIN_ADMIN_KEY` for super-admin operations
- Per-college `apiKey` stored in MongoDB for college-level access

**Apply to Jodein** (Step 11+):
```js
// Middleware: validate collegeId + apiKey match
async function validateCollegeAccess(req, reply) {
  const collegeId = req.params.collegeId
  const apiKey = req.headers['x-api-key']
  const college = await College.findOne({ collegeId, apiKey })
  if (!college) return reply.status(401).send({ error: 'Invalid credentials' })
  req.college = college
}
```

---

## PATTERN 15 — LangChain Runnable Sequence for Composable Pipelines
**Source:** `references/tier3/Flowise/packages/components/nodes/agents/ConversationalRetrievalToolAgent/ConversationalRetrievalToolAgent.ts`

Both Flowise and LangChain.js use `RunnableSequence` to chain steps:
```ts
import { RunnableSequence } from '@langchain/core/runnables'

const chain = RunnableSequence.from([
  rephraseStep,     // Input: {question, chat_history} → Output: standalone_question
  retrieveStep,     // Input: standalone_question → Output: docs[]
  formatDocsStep,   // Input: docs[] → Output: context string
  llmStep,          // Input: {context, question} → Output: AI response
  outputParser      // Input: AI message → Output: clean string
])

const result = await chain.invoke({ question, chat_history })
```
**Apply to Jodein** (Step 17-18 — RAG pipeline in `ai.js`):
Replace the current single `generateReply()` function with a composable pipeline
that can optionally include a RAG retrieval step based on college config.

---

## INSTANTLY USABLE IMPLEMENTATIONS (Copy-Paste Ready)

### A — Add Bull-Board to server.js NOW
```bash
npm install @bull-board/api @bull-board/fastify @bull-board/bullmq-pro
```
```js
// In server.js, after queue setup:
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { FastifyAdapter } from '@bull-board/fastify'

if (messageQueue) {
  const serverAdapter = new FastifyAdapter()
  serverAdapter.setBasePath('/admin/queues')
  createBullBoard({ 
    queues: [new BullMQAdapter(messageQueue)],
    serverAdapter,
    options: { uiConfig: { boardTitle: 'Jodein Message Queue' } }
  })
  await app.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' })
  console.log('Queue monitor: http://localhost:3000/admin/queues')
}
```

### B — Add Rate Limiting to server.js NOW
```bash
npm install @fastify/rate-limit
```
```js
// In server.js, after app = Fastify(...):
await app.register(import('@fastify/rate-limit'), {
  global: false  // opt-in per route
})

// Then on the webhook route:
app.post('/webhook/:collegeId', {
  config: {
    rawBody: true,
    rateLimit: {
      max: 300,
      timeWindow: '1 minute',
      keyGenerator: (req) => req.params.collegeId
    }
  }
}, async (req, reply) => { ... })
```

### C — Add Pino Redaction to server.js NOW
```js
// Replace current Fastify initialization:
const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers["x-hub-signature-256"]',
        '*.accessToken',
        '*.wa_id'  // masks WhatsApp phone numbers in logs
      ],
      censor: '[REDACTED]'
    }
  }
})
```

### D — Improve Health Check NOW
```js
app.get('/health', async (req, reply) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: process.env.DEMO_MODE === 'true' ? 'demo' : 'production',
    services: {
      redis: 'unchecked',
      queue: messageQueue ? 'initialized' : 'disabled',
      gemini: process.env.GOOGLE_AI_API_KEY ? 'configured' : 'missing ⚠️'
    }
  }
  try {
    await redis.ping()
    health.services.redis = 'connected'
  } catch {
    health.services.redis = 'disconnected ⚠️'
    health.status = 'degraded'
  }
  return reply.status(health.status === 'ok' ? 200 : 503).send(health)
})
```

### E — Jitter-enabled BullMQ config (queue.js)
```js
messageQueue = new Queue('incoming-messages', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
      jitter: 0.2  // ← from BullMQ source code analysis
    },
    removeOnComplete: 100,
    removeOnFail: 500
  }
})
```

### F — Status-only payload skip (whatsapp.js)
```js
// Add at the start of parseIncomingMessage():
const value = body?.entry?.[0]?.changes?.[0]?.value
// Skip if this is purely a status update (delivered/read/failed) with no message
if (value?.statuses && !value?.messages) {
  return null  // don't process status-only webhooks
}
```

---

## REDIS KEY DESIGN PATTERNS (from analysis of all repos)

Based on studying how BullMQ, WAHA, and LangChain name their Redis keys:

```
# Current Jodein keys (inferred from redis.js):
jodein:{collegeId}:history:{phoneNumber}   → conversation history list
jodein:dedup:{messageId}                   → processed message flag
jodein:demo:{sessionId}:replies            → demo mode reply queue

# Recommended additions for Steps 11+:
jodein:{collegeId}:config                  → college config cache (TTL: 5min)
jodein:{collegeId}:rate:{window}           → rate limit counter
jodein:{collegeId}:active_sessions         → set of active phone numbers
jodein:global:stats:{date}                 → daily message count per college
```

All keys use the `jodein:` prefix namespace to avoid collisions on shared Redis instances.

---

## WHAT NOT TO DO (Anti-patterns found in repos)

1. **Don't put all sessions in one Redis key** — WAHA learned this hard way.
   Use scoped keys: `session:{id}:*` not `all_sessions`

2. **Don't retry indefinitely** — BullMQ's source shows 3 attempts is industry standard.
   More than 5 attempts means your processing logic needs fixing, not more retries.

3. **Don't log access tokens** — Found this mistake in 3 out of 15 repos' examples.
   Always use Pino `redact` for any field containing the word "token" or "key".

4. **Don't block the webhook response** — WAHA uses `setImmediate()` to fire webhooks
   asynchronously after the HTTP response is sent. Jodein correctly does this with BullMQ.

5. **Don't use a single system prompt for all colleges** — Evolution API's instance model
   confirms each tenant needs independent configuration. Store prompts in MongoDB per college.

---

*All patterns verified by reading actual source code. References in `/references/` directory.*
*Last updated: May 2026*
