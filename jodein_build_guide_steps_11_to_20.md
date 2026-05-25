# Jodein — Build Guide: Steps 11 to 20
## Multi-Tenant Engine + Student Onboarding + RAG + Admin Dashboard

> Prerequisites: Steps 1–10 complete. Your bot receives messages, replies
> intelligently, uses a queue, and rejects fake requests.
> Now you go from "one bot" to "a platform."

---

---

# THE 25 REPOS YOU WILL ACTUALLY USE

Curated from the 50-tool research file. Sorted by when you need them.

| # | Repo | Use In | Why This One |
|---|------|--------|-------------|
| 1 | [Mongoose](https://github.com/Automattic/mongoose) ⭐27k | Step 11 | MongoDB ODM — defines College/Student schemas |
| 2 | [Zod](https://github.com/colinhacks/zod) ⭐35k | Step 11+ | Validate env vars, API inputs, LLM outputs |
| 3 | [AdminJS](https://github.com/SoftwareBrothers/adminjs) ⭐8k | Step 12 | Auto-CRUD UI from MongoDB schema |
| 4 | [n8n](https://github.com/n8n-io/n8n) ⭐50k | Step 13 | CSV upload → bulk WhatsApp — zero code |
| 5 | [Instructor JS](https://github.com/instructor-ai/instructor-js) ⭐1k | Step 14 | Force Gemini to return structured JSON |
| 6 | [Agenda](https://github.com/agenda/agenda) ⭐9k | Step 15 | MongoDB-based cron — daily attendance jobs |
| 7 | [LangChain.js](https://github.com/langchain-ai/langchainjs) ⭐13k | Step 17+ | RAG chains, agents, tool calling |
| 8 | [LlamaIndex.TS](https://github.com/run-llama/LlamaIndexTS) ⭐2k | Step 17 | PDF → chunks → embeddings — most accurate |
| 9 | [Qdrant](https://github.com/qdrant/qdrant) ⭐22k | Step 17 | Self-hosted vector DB, better than Pinecone free tier |
| 10 | [Chroma](https://github.com/chroma-core/chroma) ⭐16k | Step 17 | Local alternative to Qdrant for dev |
| 11 | [Flowise](https://github.com/FlowiseAI/Flowise) ⭐35k | Step 17 | Visually prototype RAG before coding it |
| 12 | [Vercel AI SDK](https://github.com/vercel/ai) ⭐12k | Step 18 | Swap Gemini → Claude → GPT with 1 line change |
| 13 | [Shadcn/ui](https://github.com/shadcn-ui/ui) ⭐82k | Step 19 | Admin dashboard components |
| 14 | [Tremor](https://github.com/tremorlabs/tremor) ⭐17k | Step 19 | Analytics charts (messages/day, response times) |
| 15 | [Recharts](https://github.com/recharts/recharts) ⭐23k | Step 19 | Custom charts if Tremor is too opinionated |
| 16 | [NextAuth.js](https://github.com/nextauthjs/next-auth) ⭐26k | Step 19 | Free Clerk alternative — Google OAuth for college admins |
| 17 | [Casl](https://github.com/stalniy/casl) ⭐6k | Step 19 | Role-based access: super-admin vs college-admin |
| 18 | [BullBoard](https://github.com/felixmosh/bull-board) ⭐5k | Step 20 | Visual dashboard for your BullMQ queues |
| 19 | [PostHog](https://github.com/PostHog/posthog) ⭐24k | Step 20 | Product analytics — what students ask most |
| 20 | [SigNoz](https://github.com/SigNoz/signoz) ⭐20k | Step 20 | Distributed traces — which college is slowest |
| 21 | [GlitchTip](https://gitlab.com/glitchtip/glitchtip) ⭐1.5k | Step 20 | Self-hosted error tracking (free Sentry) |
| 22 | [@fastify/rate-limit](https://github.com/fastify/fastify-rate-limit) ⭐800 | Step 20 | Per-college rate limiting |
| 23 | [Vitest](https://github.com/vitest-dev/vitest) ⭐14k | Any step | Unit test your critical functions |
| 24 | [Dotenvx](https://github.com/dotenvx/dotenvx) ⭐3k | Any step | Manage dev/staging/prod .env cleanly |
| 25 | [Evolution API](https://github.com/EvolutionAPI/evolution-api) ⭐4k | Step 50+ | Multi-number gateway when scaling to 100+ colleges |

---

---

# STEP 11 — Multi-Tenant MongoDB Schema

## What you are doing and why

Right now every message goes through the same bot with the same system prompt.
At LNMIIT, the bot should say "You are the LNMIIT campus assistant."
At a college in Jaipur, it should say "You are the campus assistant for Poornima College."

Multi-tenancy means: one codebase, one running server, N colleges — each fully isolated.
MongoDB stores each college's configuration. The worker reads it at runtime.

Everything from Step 11 onwards builds on this schema.

## 11.1 — Install Mongoose and Zod

```bash
pnpm add mongoose zod
```

## 11.2 — Connect to MongoDB Atlas

Create a free MongoDB Atlas account at https://cloud.mongodb.com
- Create a free M0 cluster (512MB — enough for 10K students)
- Create a database user (username + password)
- Whitelist all IPs (0.0.0.0/0) for now
- Get your connection string: `mongodb+srv://user:pass@cluster.mongodb.net/jodein`
- Add to .env: `MONGODB_URI=mongodb+srv://...`

```javascript
// src/db.js
import mongoose from 'mongoose'
import { config } from 'dotenv'
config()

let isConnected = false

export async function connectDB() {
  if (isConnected) return

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'jodein',
    })
    isConnected = true
    console.log('MongoDB connected')
  } catch (err) {
    console.error('MongoDB connection failed:', err.message)
    process.exit(1)  // don't start if DB is down
  }
}
```

## 11.3 — Define the College schema

This is the most important schema in the entire system.
Every bot configuration lives here.

```javascript
// src/models/College.js
import mongoose from 'mongoose'

const CollegeSchema = new mongoose.Schema({

  // Identity
  collegeId:   { type: String, required: true, unique: true },  // "lnmiit", "poornima"
  name:        { type: String, required: true },                 // "LNM Institute of IT"
  city:        { type: String },                                 // "Jaipur"

  // WhatsApp credentials (encrypted in production — Step 10 covers secrets)
  whatsapp: {
    phoneNumberId: { type: String, required: true },
    accessToken:   { type: String, required: true },  // store encrypted, decrypt at runtime
  },

  // AI configuration — each college can have different behavior
  ai: {
    model:        { type: String, default: 'gemini-1.5-flash-latest' },
    systemPrompt: {
      type: String,
      default: 'You are a helpful campus assistant. Answer only academic and campus-related queries.'
    },
    temperature:    { type: Number, default: 0.7 },
    maxTokens:      { type: Number, default: 500 },
    contextWindow:  { type: Number, default: 10 },   // last N messages to include
  },

  // Feature toggles — turn on/off per college
  features: {
    webSearch:          { type: Boolean, default: false },
    imageUnderstanding: { type: Boolean, default: false },
    voiceTranscription: { type: Boolean, default: false },
    ragEnabled:         { type: Boolean, default: false },
  },

  // Rate limiting
  limits: {
    maxMessagesPerUserPerHour: { type: Number, default: 20 },
    maxMessagesPerUserPerDay:  { type: Number, default: 50 },
  },

  // Status
  status:    { type: String, enum: ['active', 'paused', 'draft'], default: 'draft' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

}, { timestamps: true })

export const College = mongoose.model('College', CollegeSchema)
```

## 11.4 — Define the Student schema

```javascript
// src/models/Student.js
import mongoose from 'mongoose'

const StudentSchema = new mongoose.Schema({
  collegeId:    { type: String, required: true },   // foreign key to College
  studentId:    { type: String, required: true },   // college's internal roll number
  name:         { type: String },
  branch:       { type: String },   // "CSE", "ECE", "Mech"
  year:         { type: Number },   // 1, 2, 3, 4
  section:      { type: String },   // "A", "B"

  // WhatsApp identifiers
  phone:        { type: String },   // student's WhatsApp: "919876543210"
  parentPhone:  { type: String },   // parent's WhatsApp: "919876540001"

  // Activation status — set to true when student types their ID in WhatsApp
  activated:    { type: Boolean, default: false },
  activatedAt:  { type: Date },

}, { timestamps: true })

// Compound index — same studentId can't appear twice in same college
StudentSchema.index({ collegeId: 1, studentId: 1 }, { unique: true })
// Index for fast phone lookup (used on every incoming message)
StudentSchema.index({ collegeId: 1, phone: 1 })

export const Student = mongoose.model('Student', StudentSchema)
```

## 11.5 — Define the MessageLog schema

```javascript
// src/models/MessageLog.js
import mongoose from 'mongoose'

// Logs every message — used for analytics in Step 20
const MessageLogSchema = new mongoose.Schema({
  collegeId:       { type: String, required: true },
  userId:          { type: String, required: true },   // phone number
  studentId:       { type: String },                   // if activated student
  direction:       { type: String, enum: ['in', 'out'] },
  message:         { type: String },
  responseTimeMs:  { type: Number },                   // how long the reply took
  model:           { type: String },                   // which LLM was used
  error:           { type: String },                   // if processing failed
  timestamp:       { type: Date, default: Date.now },
})

// TTL index — auto-delete logs older than 90 days to save storage
MessageLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 })

export const MessageLog = mongoose.model('MessageLog', MessageLogSchema)
```

## 11.6 — Seed LNMIIT as your first college

```javascript
// scripts/seed-college.js
import { connectDB } from '../src/db.js'
import { College } from '../src/models/College.js'

await connectDB()

const lnmiit = await College.findOneAndUpdate(
  { collegeId: 'lnmiit' },
  {
    collegeId: 'lnmiit',
    name:      'LNM Institute of Information Technology',
    city:      'Jaipur',
    whatsapp: {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken:   process.env.WHATSAPP_ACCESS_TOKEN,
    },
    ai: {
      systemPrompt: `You are the campus assistant for LNM Institute of Information Technology (LNMIIT), Jaipur.
      You help students with syllabus queries, timetables, exam schedules, attendance status, and general campus information.
      Always respond in the same language the student uses — Hindi, English, or Hinglish.
      If you don't have specific information, say: "Iske baare mein main confirm nahi kar sakta — please apne department se verify karein."
      Keep answers concise — this is WhatsApp, not an email.`,
    },
    status: 'active',
  },
  { upsert: true, new: true }
)

console.log('Seeded college:', lnmiit.collegeId)
process.exit(0)
```

```bash
# Run once to seed your first college
node scripts/seed-college.js
```

## What can go wrong
- "Authentication failed": MongoDB Atlas username/password in URI is wrong
- "Network timeout": You haven't whitelisted your IP in Atlas Network Access
- "E11000 duplicate key": You ran the seed script twice — safe to ignore,
  `upsert: true` handles this gracefully

## Resources
- Mongoose docs: https://mongoosejs.com/docs
- MongoDB Atlas setup: https://www.mongodb.com/docs/atlas/getting-started
- Mongoose GitHub: https://github.com/Automattic/mongoose

---

---

# STEP 12 — Worker Loads College Config from MongoDB

## What you are doing and why

The worker currently uses hardcoded values (one system prompt, one WhatsApp token).
This step makes it dynamic: every job carries a `collegeId`, the worker fetches
that college's config from MongoDB, and uses it. College A gets College A's
system prompt and WhatsApp number. College B gets College B's. Completely isolated.

## 12.1 — Add a config cache to avoid DB calls on every message

Calling MongoDB on every single message is wasteful. College configs rarely change.
Cache them in memory for 5 minutes.

```javascript
// src/configCache.js
import { College } from './models/College.js'

const cache    = new Map()      // in-memory cache
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

export async function getCollegeConfig(collegeId) {
  const now    = Date.now()
  const cached = cache.get(collegeId)

  // Return cached version if it exists and is fresh
  if (cached && (now - cached.fetchedAt) < CACHE_TTL) {
    return cached.config
  }

  // Fetch from MongoDB
  const college = await College.findOne({ collegeId, status: 'active' })

  if (!college) {
    console.warn(`No active college found for id: ${collegeId}`)
    return null
  }

  // Store in cache
  cache.set(collegeId, { config: college, fetchedAt: now })
  console.log(`[Cache] Loaded config for ${collegeId}`)

  return college
}

// Call this when a college admin updates their config via dashboard
export function invalidateCache(collegeId) {
  cache.delete(collegeId)
  console.log(`[Cache] Invalidated config for ${collegeId}`)
}
```

## 12.2 — Update the worker to use college config

```javascript
// src/worker.js — updated to use MongoDB config

import { Worker }          from 'bullmq'
import { connection }      from './queue.js'
import { connectDB }       from './db.js'
import { getCollegeConfig } from './configCache.js'
import { sendTextMessage, sendTypingIndicator } from './whatsapp.js'
import { generateReply }   from './ai.js'
import { getHistory, addToHistory } from './redis.js'
import { MessageLog }      from './models/MessageLog.js'
import { Student }         from './models/Student.js'

// Connect to DB when worker starts
await connectDB()

const worker = new Worker(
  'incoming-messages',

  async (job) => {
    const { collegeId, parsed } = job.data
    const startTime = Date.now()

    // STEP 1: Load college config from cache/MongoDB
    const college = await getCollegeConfig(collegeId)

    if (!college) {
      // College not found or paused — silently drop the message
      console.warn(`Dropping message — no config for college: ${collegeId}`)
      return
    }

    // STEP 2: Look up student by phone number
    // This personalizes the response (we know their branch, year, name)
    const student = await Student.findOne({
      collegeId,
      phone:     parsed.from,
      activated: true
    })

    // STEP 3: Build a personalized system prompt
    // If student is known, inject their context into the system prompt
    let systemPrompt = college.ai.systemPrompt

    if (student) {
      systemPrompt += `\n\nStudent context:
Name:    ${student.name}
Branch:  ${student.branch}
Year:    Year ${student.year}
Section: Section ${student.section}
ID:      ${student.studentId}

Use this context to personalize answers. E.g., answer syllabus questions specific to their branch and year.`
    }

    // STEP 4: Show typing indicator using college's specific WhatsApp credentials
    await sendTypingIndicator(parsed.from, parsed.messageId, college.whatsapp)

    // STEP 5: Get conversation history
    const history = await getHistory(collegeId, parsed.from)

    // STEP 6: Generate reply
    const aiReply = await generateReply(
      history,
      parsed.text,
      systemPrompt,
      college.ai  // pass ai config (model, temperature, maxTokens)
    )

    // STEP 7: Send reply using college's WhatsApp credentials
    await sendTextMessage(parsed.from, aiReply, college.whatsapp)

    // STEP 8: Save to history and log to MongoDB
    await addToHistory(collegeId, parsed.from, 'user',      parsed.text)
    await addToHistory(collegeId, parsed.from, 'assistant', aiReply)

    // Log for analytics (non-blocking — don't await)
    MessageLog.create({
      collegeId,
      userId:         parsed.from,
      studentId:      student?.studentId,
      direction:      'in',
      message:        parsed.text,
      responseTimeMs: Date.now() - startTime,
      model:          college.ai.model,
    }).catch(err => console.error('Log error (non-critical):', err.message))

  },
  { connection, concurrency: 5 }
)

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message)
})
```

## 12.3 — Update sendTextMessage and sendTypingIndicator to accept credentials

```javascript
// src/whatsapp.js — updated signatures

// Now accepts college's whatsapp credentials instead of reading from env
export async function sendTextMessage(toNumber, messageText, credentials = null) {
  const phoneNumberId = credentials?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken   = credentials?.accessToken   || process.env.WHATSAPP_ACCESS_TOKEN

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`
  // ... rest of function unchanged
}

export async function sendTypingIndicator(toNumber, messageId, credentials = null) {
  const phoneNumberId = credentials?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID
  const accessToken   = credentials?.accessToken   || process.env.WHATSAPP_ACCESS_TOKEN
  // ... rest of function unchanged
}
```

## Test milestone for Step 12
- Add a second college to MongoDB (manually insert a document with a different collegeId)
- Send a message to each test number
- Verify the logs show different system prompts being used for each college

---

---

# STEP 13 — Bulk Student Onboarding via CSV Upload

## What you are doing and why
A college has 3,000 students. You cannot add them one by one.
The college admin uploads one CSV file. Your system reads it, saves every
student to MongoDB, and sends each student a WhatsApp activation message.

## 13.1 — Define the expected CSV format

Tell every college to provide this exact format (share as a template):

```csv
studentId,name,branch,year,section,phone,parentPhone
2022CSE001,Rahul Sharma,CSE,3,A,919876543210,919876540001
2022CSE002,Priya Singh,CSE,3,A,919876543211,919876540002
2022ECE001,Amit Kumar,ECE,2,B,919876543212,919876540003
```

Rules to communicate to colleges:
- Phone numbers must include country code without + (91XXXXXXXXXX)
- studentId must be unique within the college
- CSV must be UTF-8 encoded (important for Hindi names)

## 13.2 — Install CSV parser

```bash
pnpm add csv-parse
```

## 13.3 — Write the CSV ingestion service

```javascript
// src/services/studentOnboarding.js
import { parse }    from 'csv-parse/sync'
import fs           from 'fs'
import { Student }  from '../models/Student.js'
import { messageQueue } from '../queue.js'

export async function ingestStudentCSV(collegeId, csvFilePath) {
  console.log(`[Onboarding] Starting CSV ingestion for ${collegeId}`)

  // Read and parse CSV
  const fileContent = fs.readFileSync(csvFilePath, 'utf-8')
  const rows        = parse(fileContent, {
    columns:          true,   // first row is headers
    skip_empty_lines: true,
    trim:             true,   // remove whitespace from values
  })

  console.log(`[Onboarding] Parsed ${rows.length} students from CSV`)

  let created  = 0
  let skipped  = 0
  let errors   = 0
  const failed = []

  for (const row of rows) {
    try {
      // Validate required fields
      if (!row.studentId || !row.phone) {
        failed.push({ row, reason: 'Missing studentId or phone' })
        errors++
        continue
      }

      // Normalize phone — strip all non-digits, ensure starts with 91
      const phone       = normalizePhone(row.phone)
      const parentPhone = row.parentPhone ? normalizePhone(row.parentPhone) : null

      if (!phone) {
        failed.push({ row, reason: 'Invalid phone format' })
        errors++
        continue
      }

      // Upsert (insert or update if already exists)
      const result = await Student.findOneAndUpdate(
        { collegeId, studentId: row.studentId },
        {
          collegeId,
          studentId:   row.studentId,
          name:        row.name,
          branch:      row.branch,
          year:        parseInt(row.year),
          section:     row.section,
          phone,
          parentPhone,
          // Don't overwrite activated:true if student already activated
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )

      // Queue an activation message to this student
      // Only if they haven't activated yet
      if (!result.activated) {
        await messageQueue.add('send-activation', {
          collegeId,
          studentPhone: phone,
          studentName:  row.name,
          studentId:    row.studentId,
        }, {
          delay: created * 200,  // stagger: send 1 message every 200ms
                                 // avoids hitting WhatsApp rate limits
          jobId: `activation-${collegeId}-${row.studentId}`
        })
      }

      created++

    } catch (err) {
      console.error(`Error processing student ${row.studentId}:`, err.message)
      errors++
    }
  }

  console.log(`[Onboarding] Done: ${created} created, ${skipped} skipped, ${errors} errors`)

  return { created, skipped, errors, failed }
}

// Normalize phone to E.164 without + (91XXXXXXXXXX)
function normalizePhone(raw) {
  const digits = raw.toString().replace(/\D/g, '')  // remove non-digits

  if (digits.length === 10) return `91${digits}`     // 9876543210 → 919876543210
  if (digits.length === 12 && digits.startsWith('91')) return digits
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(1)

  return null  // invalid
}
```

## 13.4 — Add the activation message sender to the worker

```javascript
// Add to src/worker.js — second worker processor for activation jobs

const activationWorker = new Worker(
  'incoming-messages',

  async (job) => {
    if (job.name !== 'send-activation') return  // skip other job types

    const { collegeId, studentPhone, studentName, studentId } = job.data
    const college = await getCollegeConfig(collegeId)
    if (!college) return

    const firstName = studentName.split(' ')[0]  // "Rahul Sharma" → "Rahul"

    const activationMessage = `Hi ${firstName}! 👋

Aapka college ka WhatsApp assistant ready hai.

*${college.name}* ka campus bot aapko help karega:
• Syllabus aur timetable queries
• Exam schedule
• Attendance status
• Campus information

Activate karne ke liye, apna *Student ID* reply karein:
Example: \`${studentId}\`

— Jodein Team`

    await sendTextMessage(studentPhone, activationMessage, college.whatsapp)
    console.log(`[Activation] Sent to ${studentPhone} (${studentName})`)
  },

  { connection, concurrency: 3 }  // lower concurrency for activation to respect rate limits
)
```

## 13.5 — Add a route to trigger CSV ingestion (internal use only)

```javascript
// Add to src/server.js — internal admin route
// Protect with a secret header in production

import { ingestStudentCSV } from './services/studentOnboarding.js'
import multipart from '@fastify/multipart'

await app.register(multipart)

app.post('/admin/ingest-students/:collegeId', async (req, reply) => {
  // Basic auth check — replace with proper auth in Step 19
  const adminSecret = req.headers['x-admin-secret']
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return reply.status(401).send('Unauthorized')
  }

  const { collegeId } = req.params
  const file          = await req.file()

  // Save uploaded file temporarily
  const tempPath = `/tmp/students-${collegeId}-${Date.now()}.csv`
  await file.toBuffer().then(buf => require('fs').writeFileSync(tempPath, buf))

  // Process (don't await — return immediately, processing happens in background)
  ingestStudentCSV(collegeId, tempPath)
    .then(result => console.log(`Ingestion complete for ${collegeId}:`, result))
    .catch(err  => console.error(`Ingestion failed for ${collegeId}:`, err))

  return reply.send({ message: 'CSV ingestion started', status: 'processing' })
})
```

```bash
pnpm add @fastify/multipart
```

## Test milestone for Step 13
Create a small test CSV with 3 students, POST it to `/admin/ingest-students/lnmiit`.
Check MongoDB — 3 students should appear. Check Railway logs — 3 activation messages
should be queued. If you have real WhatsApp numbers in the CSV, 3 messages should arrive.

---

---

# STEP 14 — Student Self-Registration via WhatsApp

## What you are doing and why
After Step 13, students receive an activation message saying "reply with your student ID."
This step handles that reply — it maps their WhatsApp phone number to their student record
so the bot can personalize all future responses.

## 14.1 — Detect activation messages in the worker

```javascript
// src/services/activation.js
import { Student } from '../models/Student.js'

// Returns true if message looks like a student ID
// Adjust the regex to match your college's ID format
// LNMIIT format: 2022CSE001 (year + branch + number)
const STUDENT_ID_REGEX = /^[0-9]{4}[A-Z]{2,4}[0-9]{3,4}$/i

export function looksLikeStudentId(text) {
  const trimmed = text.trim().toUpperCase()
  return STUDENT_ID_REGEX.test(trimmed)
}

export async function attemptActivation(collegeId, phone, studentIdAttempt) {
  const studentId = studentIdAttempt.trim().toUpperCase()

  // Find student with this ID in this college
  const student = await Student.findOne({ collegeId, studentId })

  if (!student) {
    return {
      success: false,
      message: `Student ID "${studentId}" nahi mila hamari records mein. Please check karein aur dobara try karein.`
    }
  }

  if (student.activated) {
    return {
      success: true,
      alreadyDone: true,
      message: `${student.name}, aapka account pehle se activate hai! Koi bhi sawaal poochh sakte hain.`
    }
  }

  // Activate — link this phone to the student record
  await Student.findByIdAndUpdate(student._id, {
    phone:       phone,
    activated:   true,
    activatedAt: new Date()
  })

  return {
    success: true,
    student,
    message: `✅ Welcome, ${student.name}!

Aapka account activate ho gaya.

Aap mujhse poochh sakte hain:
• *syllabus* — semester ke subjects
• *timetable* — class schedule
• *attendance* — aapki attendance
• *exams* — upcoming exam dates

Kya help chahiye?`
  }
}
```

## 14.2 — Wire activation into the main worker flow

```javascript
// src/worker.js — add activation check before normal message processing

import { looksLikeStudentId, attemptActivation } from './services/activation.js'

// Inside the main worker function, BEFORE generating AI reply:

    // Check if student is already activated
    const student = await Student.findOne({ collegeId, phone: parsed.from, activated: true })

    if (!student) {
      // Student not activated yet

      if (looksLikeStudentId(parsed.text)) {
        // They're trying to activate — attempt it
        const result = await attemptActivation(collegeId, parsed.from, parsed.text)
        await sendTextMessage(parsed.from, result.message, college.whatsapp)
        return  // don't continue to LLM — activation reply is the response
      } else {
        // Not activated AND not sending a student ID
        const prompt = `Namaste! 👋

Main Jodein hun — ${college.name} ka campus assistant.

Apna account activate karne ke liye apna *Student ID* bhejein.
Example: \`2022CSE001\`

College ne aapko ek activation message bheja tha — wahan se ID check karein.`

        await sendTextMessage(parsed.from, prompt, college.whatsapp)
        return
      }
    }

    // Student IS activated — proceed with normal LLM response
    // ... (existing code continues here)
```

## 14.3 — Handle edge cases in activation

```javascript
// Add to src/services/activation.js

// Handle common student mistakes
export function cleanStudentIdInput(text) {
  return text
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')          // remove spaces: "2022 CSE 001" → "2022CSE001"
    .replace(/[^\w]/g, '')        // remove special chars
}

// Students sometimes type "My ID is 2022CSE001" instead of just the ID
export function extractStudentId(text) {
  // Try to extract ID pattern from natural language
  const match = text.toUpperCase().match(/[0-9]{4}[A-Z]{2,4}[0-9]{3,4}/)
  return match ? match[0] : text.trim().toUpperCase()
}
```

## Test milestone for Step 14
- Ensure 3 students exist in MongoDB with `activated: false`
- Send a WhatsApp message with a valid student ID
- Check MongoDB — `activated` should be `true`, `phone` should be set
- Send any message from the same number — bot should now respond with personalized context

---

---

# STEP 15 — Attendance ERP Connector

## What you are doing and why
This is the feature that sells the product to college admins.
When a student is absent, their parent gets a WhatsApp message within minutes.
No manual work. No phone calls from admin staff.

You build a flexible connector that accepts attendance data in any format the
college can provide — because their data format will never be what you expect.

## 15.1 — Install Agenda for scheduled jobs

```bash
pnpm add @hokify/agenda
```

## 15.2 — Define attendance data format (normalize everything to this)

```javascript
// src/services/attendance.js

// This is the canonical shape of an attendance record in Jodein
// No matter what format colleges send, we convert to this first
const AttendanceRecord = {
  collegeId:  'lnmiit',
  studentId:  '2022CSE001',
  date:       '2024-01-15',          // YYYY-MM-DD
  subject:    'Data Structures',     // optional
  period:     2,                     // optional — which class period
  status:     'absent',              // 'present' | 'absent' | 'late'
  markedAt:   new Date(),
  markedBy:   'Dr. Sharma',          // optional — faculty name
}
```

## 15.3 — CSV attendance ingestion

Most colleges will give you a CSV. This is the most common format.

```javascript
// src/services/attendance.js
import { parse }         from 'csv-parse/sync'
import { Student }       from '../models/Student.js'
import { messageQueue }  from '../queue.js'
import fs                from 'fs'

// Expected CSV format (share this template with college IT team):
// date,studentId,subject,period,status
// 2024-01-15,2022CSE001,Data Structures,2,absent
// 2024-01-15,2022CSE002,Data Structures,2,present

export async function ingestAttendanceCSV(collegeId, csvFilePath) {
  const fileContent = fs.readFileSync(csvFilePath, 'utf-8')
  const rows        = parse(fileContent, { columns: true, skip_empty_lines: true, trim: true })

  let alertsSent = 0
  let notFound   = 0

  for (const row of rows) {
    // Only process absents — no need to alert parent for present
    if (row.status?.toLowerCase() !== 'absent') continue

    // Find the student
    const student = await Student.findOne({
      collegeId,
      studentId: row.studentId,
      activated: true
    })

    if (!student || !student.parentPhone) {
      notFound++
      continue
    }

    // Queue an attendance alert
    await messageQueue.add('attendance-alert', {
      collegeId,
      studentId:   student.studentId,
      studentName: student.name,
      phone:       student.phone,        // student's phone
      parentPhone: student.parentPhone,  // parent's phone
      date:        row.date,
      subject:     row.subject,
      period:      row.period,
      markedBy:    row.markedBy,
    }, {
      jobId: `attend-${collegeId}-${row.studentId}-${row.date}-${row.period || 'all'}`
      // jobId prevents duplicate alerts for same class period
    })

    alertsSent++
  }

  console.log(`[Attendance] ${alertsSent} alerts queued, ${notFound} students not found`)
  return { alertsSent, notFound }
}
```

## 15.4 — Set up Agenda for scheduled polling

Some colleges have a web portal or ERP REST API. You poll it every 30 minutes.

```javascript
// src/agenda.js
import { Agenda } from '@hokify/agenda'
import { config } from 'dotenv'
config()

export const agenda = new Agenda({
  db: { address: process.env.MONGODB_URI, collection: 'agendaJobs' },
  processEvery: '1 minute',
})

// Define the attendance polling job
agenda.define('poll-attendance', { concurrency: 1 }, async (job) => {
  const { collegeId } = job.attrs.data
  console.log(`[Agenda] Polling attendance for ${collegeId}`)

  // This is where you call the college's ERP API
  // Implementation varies per college — see Step 15.5
  await pollCollegeERP(collegeId)
})

// Start Agenda
export async function startAgenda() {
  await agenda.start()

  // Schedule attendance polling for each college every 30 minutes
  // (adjust frequency based on how often college updates attendance)
  await agenda.every('30 minutes', 'poll-attendance', { collegeId: 'lnmiit' })

  console.log('Agenda scheduler started')
}
```

## 15.5 — The ERP adapter pattern

This is the most important design decision for attendance.
Every college has a different system. You build one adapter per ERP type.

```javascript
// src/erp-adapters/index.js

// ERP adapter registry — maps ERP type to its adapter
import { FedenaAdapter }     from './fedena.js'
import { GoogleSheetAdapter } from './google-sheets.js'
import { CSVEmailAdapter }    from './csv-email.js'
import { ManualAdapter }      from './manual.js'

export function getERPAdapter(college) {
  const erpType = college.erp?.type || 'manual'

  switch (erpType) {
    case 'fedena':       return new FedenaAdapter(college.erp.config)
    case 'google-sheet': return new GoogleSheetAdapter(college.erp.config)
    case 'csv-email':    return new CSVEmailAdapter(college.erp.config)
    case 'manual':
    default:             return new ManualAdapter(college.erp.config)
  }
}
```

```javascript
// src/erp-adapters/manual.js
// The adapter for colleges with no ERP — they upload CSV manually

export class ManualAdapter {
  async fetchTodayAbsents(collegeId) {
    // Nothing to poll automatically
    // Attendance comes from manual CSV uploads via the admin dashboard
    return []
  }
}
```

```javascript
// src/erp-adapters/google-sheets.js
// For colleges that paste attendance into a shared Google Sheet

import { GoogleSpreadsheet } from 'google-spreadsheet'

export class GoogleSheetAdapter {
  constructor(config) {
    this.sheetId = config.sheetId    // the Google Sheet ID
    this.apiKey  = config.apiKey     // Google API key (read-only)
  }

  async fetchTodayAbsents(collegeId) {
    const doc   = new GoogleSpreadsheet(this.sheetId)
    await doc.useApiKey(this.apiKey)
    await doc.loadInfo()

    const today = new Date().toISOString().slice(0, 10)  // "2024-01-15"
    const sheet = doc.sheetsByIndex[0]
    const rows  = await sheet.getRows()

    return rows
      .filter(row => row.date === today && row.status === 'absent')
      .map(row => ({
        studentId: row.studentId,
        subject:   row.subject,
        date:      row.date,
      }))
  }
}
```

## Resources
- Agenda GitHub: https://github.com/agenda/agenda
- google-spreadsheet npm: https://www.npmjs.com/package/google-spreadsheet
- Fedena API: https://github.com/projectfedena/fedena (study for REST adapter)

---

---

# STEP 16 — Parent Alert Worker

## What you are doing and why
The attendance alert message is the most emotionally impactful feature.
It must be well-formatted, warm, and arrive quickly.
A parent receiving "Rahul ne aaj period 2 attend nahi kiya" in 5 minutes
is the moment that makes Jodein indispensable.

## 16.1 — Add the attendance alert processor to the worker

```javascript
// src/worker.js — add attendance alert job processor

import { getCollegeConfig } from './configCache.js'

// This processes 'attendance-alert' jobs from the queue
const attendanceWorker = new Worker(
  'incoming-messages',

  async (job) => {
    if (job.name !== 'attendance-alert') return

    const {
      collegeId, studentName, studentId,
      phone, parentPhone, date, subject, period, markedBy
    } = job.data

    const college = await getCollegeConfig(collegeId)
    if (!college) return

    // Format date nicely: "2024-01-15" → "Monday, 15 January 2024"
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })

    // Message to PARENT
    const parentMessage =
`📋 *Attendance Alert — ${college.name}*

*Student:* ${studentName} (${studentId})
*Date:* ${formattedDate}
*Status:* ❌ Absent${subject ? `\n*Subject:* ${subject}` : ''}${period ? `\n*Period:* ${period}` : ''}${markedBy ? `\n*Faculty:* ${markedBy}` : ''}

Agar koi samasya hai, please apne ward se baat karein ya college se contact karein.

— Jodein, ${college.name}`

    // Message to STUDENT
    const studentMessage =
`📋 *Attendance Update*

${formattedDate} ko *${subject || 'class'}* mein aapki attendance absent mark ki gayi hai.${period ? ` (Period ${period})` : ''}

Agar yeh galat hai, apne faculty se confirm karein.`

    // Send to parent
    if (parentPhone) {
      await sendTextMessage(parentPhone, parentMessage, college.whatsapp)
      console.log(`[Alert] Parent notified for ${studentName}`)
    }

    // Send to student (always)
    if (phone) {
      await sendTextMessage(phone, studentMessage, college.whatsapp)
    }
  },

  { connection, concurrency: 10 }  // higher concurrency for alerts — they're fast
)
```

## 16.2 — Add attendance query command to the bot

Students should be able to ask the bot about their own attendance:

```javascript
// Add to the system prompt in your college config:
// "When a student asks about their attendance, tell them their current
// attendance percentage if available, or direct them to check with admin."

// Also handle the specific command in worker.js:

// Inside the main worker flow, before calling generateReply:

const text = parsed.text.trim().toLowerCase()

// Handle specific commands directly (faster than LLM)
if (text === 'attendance' || text === '/attendance') {
  const student = await Student.findOne({ collegeId, phone: parsed.from })
  if (student) {
    const msg = `📊 *Your Attendance — ${new Date().toLocaleDateString('en-IN', {month:'long',year:'numeric'})}*

To check current attendance percentage, please contact your college admin or check the college portal.

For detailed attendance, ask: "Mera attendance kitna hai [subject name] mein?"`
    await sendTextMessage(parsed.from, msg, college.whatsapp)
    return
  }
}
```

## Test milestone for Steps 15-16
- Create 2 students in MongoDB with real parentPhone values (use your own numbers)
- Upload a small attendance CSV with those students marked absent
- Within 2 minutes, both your numbers (student + parent) should receive the formatted alert
- The formatting, name, and college name should all appear correctly

---

---

# STEP 17 — RAG Pipeline: Upload Documents to Vector DB

## What you are doing and why
Right now the bot answers from its training data (Gemini's general knowledge)
plus the system prompt. It does not know LNMIIT's specific syllabus, the
exact exam schedule, or the fee structure.

RAG (Retrieval-Augmented Generation) fixes this:
1. You upload your college's documents (syllabi PDFs, handbooks, Q&A sheets)
2. System chunks and embeds them into a vector database
3. When a student asks a question, the system retrieves the relevant chunks
4. LLM answers using those chunks as context — accurate to your college's data

## 17.1 — Choose your vector DB: Qdrant (recommended)

Qdrant is self-hosted, free, production-grade, and runs on Railway.
No cold-start issues (unlike Pinecone free tier).

```bash
# Run Qdrant locally for development
docker run -p 6333:6333 qdrant/qdrant

# OR deploy to Railway:
# New Service → Docker Image → qdrant/qdrant → Deploy
# Railway will give you a URL like: https://qdrant-production-abc.up.railway.app
```

Add to .env:
```
QDRANT_URL=http://localhost:6333     # or your Railway Qdrant URL
QDRANT_API_KEY=                       # leave empty for local dev
```

## 17.2 — Install LlamaIndex.TS and Qdrant client

```bash
pnpm add llamaindex @qdrant/js-client-rest pdf-parse
```

## 17.3 — Write the document ingestion pipeline

```javascript
// src/rag/ingest.js
import { Document, VectorStoreIndex, SimpleNodeParser } from 'llamaindex'
import { QdrantVectorStore }  from 'llamaindex/vector-store/QdrantVectorStore'
import { GoogleGenerativeAIEmbedding } from 'llamaindex/embeddings/GoogleGenerativeAIEmbedding'
import pdfParse from 'pdf-parse'
import fs       from 'fs'

// Creates a Qdrant collection name for a college
// Each college gets its own isolated namespace
function collectionName(collegeId) {
  return `jodein-${collegeId}`  // e.g. "jodein-lnmiit"
}

export async function ingestDocument(collegeId, filePath, documentTitle) {
  console.log(`[RAG] Starting ingestion: ${documentTitle} for ${collegeId}`)

  // STEP 1: Extract text from PDF
  let text
  if (filePath.endsWith('.pdf')) {
    const dataBuffer = fs.readFileSync(filePath)
    const pdfData    = await pdfParse(dataBuffer)
    text             = pdfData.text
  } else {
    // Plain text or markdown
    text = fs.readFileSync(filePath, 'utf-8')
  }

  if (!text || text.trim().length < 100) {
    throw new Error('Document appears empty or unreadable — check if PDF is text-based, not scanned')
  }

  console.log(`[RAG] Extracted ${text.length} characters from document`)

  // STEP 2: Create LlamaIndex Document
  const document = new Document({
    text,
    metadata: {
      collegeId,
      title:    documentTitle,
      source:   filePath,
      ingestedAt: new Date().toISOString(),
    }
  })

  // STEP 3: Set up embeddings (Google's text-embedding-004)
  const embedModel = new GoogleGenerativeAIEmbedding({
    model:   'text-embedding-004',
    apiKey:  process.env.GOOGLE_AI_API_KEY,
  })

  // STEP 4: Set up Qdrant vector store
  const vectorStore = new QdrantVectorStore({
    url:            process.env.QDRANT_URL,
    apiKey:         process.env.QDRANT_API_KEY || undefined,
    collectionName: collectionName(collegeId),
  })

  // STEP 5: Build the index (chunk → embed → store in Qdrant)
  // LlamaIndex handles chunking automatically (default: 1024 tokens per chunk)
  const index = await VectorStoreIndex.fromDocuments([document], {
    vectorStore,
    embedModel,
  })

  console.log(`[RAG] Ingestion complete: ${documentTitle}`)
  return { success: true, documentTitle }
}
```

## 17.4 — Add an ingestion API endpoint

```javascript
// Add to src/server.js

import { ingestDocument } from './rag/ingest.js'

app.post('/admin/ingest-document/:collegeId', async (req, reply) => {
  const adminSecret = req.headers['x-admin-secret']
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return reply.status(401).send('Unauthorized')
  }

  const { collegeId } = req.params
  const file          = await req.file()
  const title         = req.headers['x-document-title'] || file.filename

  // Save temporarily
  const tempPath = `/tmp/doc-${Date.now()}-${file.filename}`
  const buffer   = await file.toBuffer()
  require('fs').writeFileSync(tempPath, buffer)

  // Ingest in background
  ingestDocument(collegeId, tempPath, title)
    .then(r  => console.log('[RAG] Ingested:', r))
    .catch(e => console.error('[RAG] Ingestion failed:', e.message))

  return reply.send({ message: 'Document ingestion started' })
})
```

## 17.5 — Test ingestion before wiring to the bot

```javascript
// scripts/test-rag-ingest.js (temporary test)
import { connectDB }     from '../src/db.js'
import { ingestDocument } from '../src/rag/ingest.js'

await connectDB()

// Download LNMIIT's public syllabus PDF and save to /tmp/syllabus.pdf
// Then test:
const result = await ingestDocument(
  'lnmiit',
  '/tmp/syllabus.pdf',
  'B.Tech CSE Syllabus 2024'
)

console.log('Result:', result)
process.exit(0)
```

After running this, open Qdrant's dashboard at http://localhost:6333/dashboard
You should see a collection called `jodein-lnmiit` with vectors in it.

## Resources
- LlamaIndex.TS docs: https://ts.llamaindex.ai
- LlamaIndex.TS GitHub: https://github.com/run-llama/LlamaIndexTS
- Qdrant GitHub: https://github.com/qdrant/qdrant
- Flowise (visual RAG prototyping): https://github.com/FlowiseAI/Flowise

---

---

# STEP 18 — Bot Uses RAG to Answer College-Specific Questions

## What you are doing and why
Documents are in Qdrant. Now the bot must use them when answering.
The flow is: query → embed → retrieve matching chunks → send to Gemini with context.
The LLM answers from your college's actual data, not from the internet.

## 18.1 — Write the RAG query function

```javascript
// src/rag/query.js
import { VectorStoreIndex }               from 'llamaindex'
import { QdrantVectorStore }              from 'llamaindex/vector-store/QdrantVectorStore'
import { GoogleGenerativeAIEmbedding }    from 'llamaindex/embeddings/GoogleGenerativeAIEmbedding'

function collectionName(collegeId) {
  return `jodein-${collegeId}`
}

const SIMILARITY_THRESHOLD = 0.70  // only use chunks if they're at least 70% similar
                                    // below this, the document is probably irrelevant

export async function retrieveContext(collegeId, query, topK = 4) {
  try {
    const embedModel  = new GoogleGenerativeAIEmbedding({
      model:  'text-embedding-004',
      apiKey: process.env.GOOGLE_AI_API_KEY,
    })

    const vectorStore = new QdrantVectorStore({
      url:            process.env.QDRANT_URL,
      apiKey:         process.env.QDRANT_API_KEY || undefined,
      collectionName: collectionName(collegeId),
    })

    // Load the existing index from Qdrant
    const index = await VectorStoreIndex.fromVectorStore(vectorStore, { embedModel })

    // Create a retriever
    const retriever = index.asRetriever({ similarityTopK: topK })

    // Retrieve relevant chunks
    const nodes = await retriever.retrieve(query)

    // Filter by similarity threshold
    const relevantNodes = nodes.filter(n => n.score >= SIMILARITY_THRESHOLD)

    if (relevantNodes.length === 0) {
      console.log(`[RAG] No relevant context found for: "${query}"`)
      return null  // signal to use LLM without RAG context
    }

    // Combine chunks into context string
    const context = relevantNodes
      .map((n, i) => `[Source ${i + 1}]: ${n.node.text}`)
      .join('\n\n')

    console.log(`[RAG] Retrieved ${relevantNodes.length} relevant chunks`)
    return context

  } catch (err) {
    // If Qdrant is unreachable or collection doesn't exist yet, fail gracefully
    if (err.message.includes('Not found') || err.message.includes('ECONNREFUSED')) {
      console.warn('[RAG] Qdrant unavailable — falling back to LLM without RAG')
      return null
    }
    throw err
  }
}
```

## 18.2 — Update ai.js to use RAG context

```javascript
// src/ai.js — updated generateReply to accept RAG context

export async function generateReply(history, newMessage, systemPrompt, aiConfig = {}, ragContext = null) {
  const {
    model       = 'gemini-1.5-flash-latest',
    temperature = 0.7,
    maxTokens   = 500
  } = aiConfig

  // If RAG context found, prepend it to the system prompt
  let fullSystemPrompt = systemPrompt

  if (ragContext) {
    fullSystemPrompt = `${systemPrompt}

---
RELEVANT INFORMATION FROM COLLEGE DOCUMENTS:
${ragContext}
---

Use the above document excerpts to answer the student's question accurately.
If the answer is in the documents, use that information.
If not in the documents and you're unsure, say: "Is baare mein mere paas specific document nahi hai — please department se confirm karein."`
  }

  // ... rest of function unchanged (Gemini call)
}
```

## 18.3 — Update the worker to retrieve RAG context before calling LLM

```javascript
// src/worker.js — add RAG retrieval before generateReply

import { retrieveContext } from './rag/query.js'

// Inside main worker function, after getting history:

    // Retrieve RAG context if feature is enabled for this college
    let ragContext = null
    if (college.features.ragEnabled) {
      ragContext = await retrieveContext(collegeId, parsed.text)
    }

    // Generate reply — with or without RAG context
    const aiReply = await generateReply(
      history,
      parsed.text,
      systemPrompt,
      college.ai,
      ragContext     // pass context here
    )
```

## 18.4 — Test RAG accuracy

Ask questions that are ONLY in your uploaded document:
- "Data Structures mein kaunse topics hain?" → should answer from syllabus PDF
- "Semester 5 mein kitne credits hain?" → should answer from syllabus
- "Obama kaun hai?" → should fall through to LLM without RAG context

Watch the logs — you should see `[RAG] Retrieved N relevant chunks` for academic
queries and `[RAG] No relevant context found` for off-topic queries.

---

---

# STEP 19 — Admin Dashboard (Next.js)

## What you are doing and why
College IT staff need a visual interface to:
- Configure their bot's system prompt and AI settings
- Upload knowledge base documents
- View student list and activation status
- Monitor message volume and errors
- Manage attendance alerts

This is where they interact with Jodein daily.

## 19.1 — Create the Next.js app inside the monorepo

```bash
# From the root jodein/ folder
pnpm create next-app@latest dashboard --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd dashboard
pnpm add @shadcn/ui
npx shadcn@latest init
```

When Shadcn asks for config:
- Style: Default
- Base color: Zinc
- CSS variables: Yes

Install the components you'll use:
```bash
npx shadcn@latest add button card input label table badge switch tabs
```

## 19.2 — Set up NextAuth.js for college admin login

```bash
pnpm add next-auth @auth/mongodb-adapter mongodb
```

```typescript
// dashboard/src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { MongoDBAdapter } from '@auth/mongodb-adapter'
import clientPromise from '@/lib/mongodb-client'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  callbacks: {
    // After login, check if this email is associated with a college in MongoDB
    async session({ session, user }) {
      const collegeDoc = await College.findOne({ adminEmail: user.email })
      session.user.collegeId = collegeDoc?.collegeId || null
      session.user.isSuper   = user.email === process.env.SUPER_ADMIN_EMAIL
      return session
    }
  }
})
```

## 19.3 — The 5 core dashboard pages

```
/dashboard
├── /                      → Overview (messages today, active students, alerts sent)
├── /bot-config            → Edit system prompt, model, temperature
├── /students              → Student list, activation status, CSV upload
├── /knowledge-base        → Upload PDFs, see indexed documents
└── /analytics             → Message volume chart, response times, top queries
```

## 19.4 — Bot config page (core feature)

```typescript
// dashboard/src/app/bot-config/page.tsx
'use client'
import { useState } from 'react'
import { Button }   from '@/components/ui/button'
import { Card }     from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Switch }   from '@/components/ui/switch'

export default function BotConfigPage() {
  const [systemPrompt, setSystemPrompt] = useState('')
  const [ragEnabled,   setRagEnabled]   = useState(false)
  const [saving,       setSaving]       = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/college/config', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ systemPrompt, 'features.ragEnabled': ragEnabled })
    })
    setSaving(false)
    alert('Config saved!')
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Bot Configuration</h1>

      <Card className="p-4 mb-4">
        <label className="text-sm font-medium mb-2 block">System Prompt</label>
        <p className="text-xs text-muted-foreground mb-2">
          This defines your bot's personality and knowledge scope.
          Students see the answers, not this prompt.
        </p>
        <Textarea
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          rows={8}
          placeholder="You are the campus assistant for [College Name]..."
        />
      </Card>

      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">Enable Knowledge Base (RAG)</div>
            <div className="text-xs text-muted-foreground">
              Bot will answer from your uploaded documents
            </div>
          </div>
          <Switch checked={ragEnabled} onCheckedChange={setRagEnabled} />
        </div>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Configuration'}
      </Button>
    </div>
  )
}
```

## 19.5 — Analytics page using Tremor

```typescript
// dashboard/src/app/analytics/page.tsx
import { AreaChart, Card, Metric, Text } from '@tremor/react'

// Install Tremor: pnpm add @tremor/react

export default async function AnalyticsPage() {
  // Fetch from your API
  const stats = await fetch('/api/analytics').then(r => r.json())

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Analytics</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <Text>Messages Today</Text>
          <Metric>{stats.messagesToday}</Metric>
        </Card>
        <Card>
          <Text>Active Students</Text>
          <Metric>{stats.activeStudents}</Metric>
        </Card>
        <Card>
          <Text>Avg Response Time</Text>
          <Metric>{stats.avgResponseMs}ms</Metric>
        </Card>
      </div>

      <Card>
        <AreaChart
          data={stats.dailyMessages}
          index="date"
          categories={['messages']}
          colors={['blue']}
          className="h-64"
        />
      </Card>
    </div>
  )
}
```

## Resources
- Shadcn/ui: https://ui.shadcn.com
- Tremor GitHub: https://github.com/tremorlabs/tremor
- NextAuth.js: https://authjs.dev

---

---

# STEP 20 — Rate Limiting, BullBoard, and Analytics

## What you are doing and why
One student who accidentally runs a loop or a bad actor spamming your bot
should not affect every other college. This step puts controls in place.

## 20.1 — Add rate limiting per college

```bash
pnpm add @fastify/rate-limit
```

```javascript
// Add to src/server.js
import rateLimit from '@fastify/rate-limit'
import { redis }  from './redis.js'

await app.register(rateLimit, {
  global:    false,    // don't apply globally — only to decorated routes
  redis:     redis,    // use Redis for distributed rate limiting
  keyGenerator: (req) => {
    // Rate limit by collegeId — each college gets its own bucket
    // So College A's students can't exhaust College B's quota
    return `ratelimit:${req.params.collegeId || 'global'}`
  },
})

// Apply rate limiting to the webhook route:
app.post('/webhook/:collegeId', {
  config: {
    rateLimit: {
      max:      200,          // 200 messages per window per college
      timeWindow: '1 minute'  // reset every minute
    }
  }
}, async (req, reply) => { /* ... */ })
```

## 20.2 — Add BullBoard to monitor the queue

```bash
pnpm add @bull-board/fastify @bull-board/api
```

```javascript
// Add to src/server.js
import { createBullBoard }  from '@bull-board/api'
import { BullMQAdapter }    from '@bull-board/api/bullMQAdapter.js'
import { FastifyAdapter }   from '@bull-board/fastify'

const serverAdapter = new FastifyAdapter()
serverAdapter.setBasePath('/admin/queue')

createBullBoard({
  queues:        [new BullMQAdapter(messageQueue)],
  serverAdapter,
})

await app.register(serverAdapter.registerPlugin(), {
  prefix: '/admin/queue',
  basePath: '/admin/queue'
})

// Protect with basic auth
app.addHook('onRequest', async (req, reply) => {
  if (!req.url.startsWith('/admin/queue')) return

  const adminSecret = req.headers['x-admin-secret']
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return reply.status(401).send('Unauthorized')
  }
})
```

Now visit: `https://your-railway-url/admin/queue`
You get a real-time dashboard showing all jobs — waiting, active, completed, failed.

## 20.3 — Add PostHog for product analytics

```bash
pnpm add posthog-node
```

```javascript
// src/analytics.js
import { PostHog } from 'posthog-node'

// PostHog free tier: unlimited events, 1M/month
// Get API key at: https://app.posthog.com
const client = new PostHog(
  process.env.POSTHOG_API_KEY,
  { host: 'https://app.posthog.com' }
)

export function trackMessage(collegeId, userId, properties = {}) {
  client.capture({
    distinctId: `${collegeId}:${userId}`,
    event:      'message_received',
    properties: {
      collegeId,
      model:          properties.model,
      responseTimeMs: properties.responseTimeMs,
      hadRagContext:  properties.hadRagContext || false,
      isActivation:   properties.isActivation  || false,
    }
  })
}

export function trackAttendanceAlert(collegeId, studentId) {
  client.capture({
    distinctId: `${collegeId}:${studentId}`,
    event:      'attendance_alert_sent',
    properties: { collegeId }
  })
}
```

## 20.4 — Add GlitchTip for error tracking

```bash
pnpm add @sentry/node  # GlitchTip uses the Sentry SDK — just change the DSN
```

```javascript
// src/server.js — add at the very top
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.GLITCHTIP_DSN,  // get from: https://app.glitchtip.com
  environment: process.env.NODE_ENV || 'production',
  tracesSampleRate: 0.1,  // trace 10% of requests
})

// In your worker error handler:
worker.on('failed', (job, err) => {
  Sentry.captureException(err, {
    extra: { jobId: job.id, jobData: job.data }
  })
})
```

## 20.5 — Env checklist for Step 20

```bash
# Add to .env
ADMIN_SECRET=your_very_long_random_string
POSTHOG_API_KEY=phc_xxxx
GLITCHTIP_DSN=https://xxxx@app.glitchtip.com/N
```

## Test milestone for Step 20

- Open `/admin/queue` — see the BullBoard dashboard
- Send 201 messages in 1 minute from the same college — the 201st should get rate-limited
- Trigger a deliberate error in the worker — it should appear in GlitchTip
- After 10 messages, check PostHog Events — you should see `message_received` events

---

---

# WHEN TO TEST IN REAL DEVELOPMENT

Here is the exact sequence of real testing milestones:

```
Steps 1-6:   Test with mocked data
             → Use in-memory Map() instead of Redis
             → Use Postman to POST fake webhook payloads to your server
             → Console.log instead of actually calling WhatsApp API
             → This is where you are NOW

Step 7:      FIRST REAL TEST
             → Switch to real Upstash Redis
             → Switch to real Meta test number
             → Send from your actual phone
             → Receive reply on your actual phone
             → This is the go/no-go moment

Steps 8-10:  Still on test number, now hardening
             → Type indicator, queue, signature verification
             → All tested with your own phone

Step 11-12:  Real MongoDB, real college config
             → Still single test number
             → But now bot reads from real DB

Step 13-14:  SECOND REAL TEST — multi-student
             → Upload CSV with 5 real phone numbers (your friends/family)
             → Each receives activation message
             → Each activates and uses the bot
             → Verify personalization works per student

Step 15-16:  THIRD REAL TEST — attendance alerts
             → Upload attendance CSV marking those 5 students as absent
             → Verify 5 parents and 5 students all receive the correct formatted alert

Step 17-18:  FOURTH REAL TEST — RAG
             → Upload one real document (LNMIIT fee structure PDF)
             → Ask a question only answerable from that document
             → Verify RAG context appears in logs and answer is accurate

Step 19-20:  FINAL REAL TEST — dashboard
             → Full college admin login flow
             → Change system prompt from dashboard → bot behavior changes
             → BullBoard shows real queue stats
```

Your approach of building the skeleton first without real services is correct.
The only cost of not having real Redis right now is that the bot has no conversation
memory between restarts. For architecture validation, that is completely fine.
Flip the real services on at Step 7. Not before.

---

---

# FULL TOOL USAGE SUMMARY — STEPS 11-20

| Step | Tools Used | Install Command |
|------|-----------|-----------------|
| 11 | Mongoose, Zod | `pnpm add mongoose zod` |
| 12 | Mongoose (configCache), AdminJS (optional) | `pnpm add adminjs @adminjs/express` |
| 13 | csv-parse, @fastify/multipart | `pnpm add csv-parse @fastify/multipart` |
| 14 | (no new installs — uses existing) | — |
| 15 | @hokify/agenda, google-spreadsheet | `pnpm add @hokify/agenda google-spreadsheet` |
| 16 | (no new installs — uses existing) | — |
| 17 | llamaindex, @qdrant/js-client-rest, pdf-parse | `pnpm add llamaindex @qdrant/js-client-rest pdf-parse` |
| 18 | (no new installs — uses Step 17 libs) | — |
| 19 | Next.js, shadcn/ui, @tremor/react, next-auth | `pnpm add @tremor/react next-auth @auth/mongodb-adapter` |
| 20 | @fastify/rate-limit, @bull-board/fastify, posthog-node, @sentry/node | `pnpm add @fastify/rate-limit @bull-board/fastify @bull-board/api posthog-node @sentry/node` |

---

*Built for Jodein — Campus Intelligence on WhatsApp*
*Steps 11-20 build the platform layer on top of the bot engine from Steps 1-10.*
*Do not start Step 11 until all 10 test milestones from the first guide are passing.*
