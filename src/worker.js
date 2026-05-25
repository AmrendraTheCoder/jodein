// src/worker.js
// BullMQ worker — processes all jobs from the "incoming-messages" queue.
//
// Job types handled:
//   process-message    → main flow: activation check → AI reply
//   send-activation    → send onboarding message to new students
//   attendance-alert   → send absent notification to student + parent
//
// Design decisions from reference repo analysis:
//   PATTERN 13 (Baileys retry manager): only send "sorry" message on FINAL failed attempt
//   PATTERN 6  (WAHA WebhookConductor): use college credentials per job, not global env
//   PATTERN 12 (WAHA health check): log collegeId on every operation for traceability

import { Worker }    from 'bullmq'
import { connection } from './queue.js'
import { connectDB }  from './db.js'
import { getCollegeConfig } from './configCache.js'
import { sendTextMessage, sendTypingIndicator } from './whatsapp.js'
import { generateReply }  from './ai.js'
import { getHistory, addToHistory, clearHistory } from './redis.js'
import { MessageLog } from './models/MessageLog.js'
import { Student }    from './models/Student.js'
import { looksLikeStudentId, attemptActivation } from './services/activation.js'
import { retrieveContext } from './rag/query.js'

// Connect to MongoDB when the worker process starts
await connectDB()

console.log('[Worker] Starting — connected to MongoDB ✅')

// Commands that reset a user's conversation history
const RESET_COMMANDS = ['reset', '/reset', 'start over', '/start', 'clear', '/clear', 'naya shuru']

// ─── MAIN MESSAGE PROCESSOR ──────────────────────────────────────────────────
const worker = new Worker(
  'incoming-messages',

  async (job) => {
    // ─── ROUTING: Skip jobs meant for other processors ────────────────────
    if (job.name === 'send-activation' || job.name === 'attendance-alert') return

    const { collegeId, parsed } = job.data
    const startTime = Date.now()

    console.log(`[Worker] Processing "${job.name}" from ${parsed.name || 'Unknown'} at ${collegeId}`)

    // ─── STEP 1: Load college config ─────────────────────────────────────────
    // PATTERN 6 (WAHA): each college has independent credentials and config
    const college = await getCollegeConfig(collegeId)

    if (!college) {
      console.warn(`[Worker] No active config for college: ${collegeId} — dropping message`)
      return  // don't retry — config issue is not transient
    }

    // ─── STEP 2: Handle reset command ────────────────────────────────────────
    if (RESET_COMMANDS.includes(parsed.text.trim().toLowerCase())) {
      await clearHistory(collegeId, parsed.from)
      await sendTextMessage(
        parsed.from,
        '✅ Conversation cleared! Fresh start kar lete hain.\n\nAap kya jaanna chahte hain? 😊',
        college.whatsapp
      )
      return
    }

    // ─── STEP 3: Look up student ──────────────────────────────────────────────
    const student = await Student.findOne({
      collegeId,
      phone:     parsed.from,
      activated: true,
    })

    // ─── STEP 4: Activation flow for unregistered students ───────────────────
    if (!student) {
      if (looksLikeStudentId(parsed.text)) {
        // Student is trying to activate — attempt it
        const result = await attemptActivation(collegeId, parsed.from, parsed.text)
        await sendTextMessage(parsed.from, result.message, college.whatsapp)

        // Log activation attempt
        MessageLog.create({
          collegeId,
          userId:       parsed.from,
          direction:    'out',
          message:      result.message,
          isActivation: true,
          model:        college.ai.model,
        }).catch(err => console.error('[Worker] Log error (non-critical):', err.message))

        return
      } else {
        // Not activated and not sending a student ID — prompt them
        const prompt = `Namaste! 👋\n\nMain *${college.name}* ka campus assistant hun.\n\nShuru karne ke liye apna *Student ID* bhejein.\nExample: \`2022CSE001\`\n\nCollege ne aapko ek activation message bheja tha — wahan se ID check karein.`
        await sendTextMessage(parsed.from, prompt, college.whatsapp)
        return
      }
    }

    // ─── STEP 5: Show typing indicator ───────────────────────────────────────
    // PATTERN 6 (WAHA): use college-specific WhatsApp credentials
    await sendTypingIndicator(parsed.from, parsed.messageId, college.whatsapp)

    // ─── STEP 6: Handle direct commands (faster than LLM) ────────────────────
    const textLower = parsed.text.trim().toLowerCase()

    if (textLower === 'attendance' || textLower === '/attendance') {
      const msg = `📊 *Aapki Attendance — ${new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}*\n\n${college.features.attendanceAlerts ? 'Attendance alerts activate hain. Absent hone pe notification aayega.' : 'Detailed attendance ke liye college portal check karein.'}\n\nAur kuch poochna hai?`
      await sendTextMessage(parsed.from, msg, college.whatsapp)
      return
    }

    // ─── STEP 7: Build personalized system prompt ─────────────────────────────
    let systemPrompt = college.ai.systemPrompt

    if (student) {
      systemPrompt += `\n\nStudent context:\nName:    ${student.name}\nBranch:  ${student.branch}\nYear:    Year ${student.year}\nSection: Section ${student.section}\nID:      ${student.studentId}\n\nPersonalize answers for this student's branch and year when relevant.`
    }

    // ─── STEP 8: RAG retrieval (Step 17-18) ──────────────────────────────────
    // PATTERN 8 (Flowise): retrieve context only if feature is enabled
    // Returns null gracefully if Qdrant is unavailable or collection is empty
    let ragContext = null
    let hadRagContext = false

    if (college.features.ragEnabled) {
      ragContext    = await retrieveContext(collegeId, parsed.text)
      hadRagContext = ragContext !== null
    }

    // ─── STEP 9: Get conversation history ────────────────────────────────────
    const history = await getHistory(collegeId, parsed.from)

    // ─── STEP 10: Generate reply ──────────────────────────────────────────────
    const aiReply = await generateReply(
      history,
      parsed.text,
      systemPrompt,
      college.ai,    // per-college model/temperature/maxTokens/contextWindow
      ragContext     // null if RAG disabled or no relevant context found
    )

    // ─── STEP 11: Send reply ──────────────────────────────────────────────────
    await sendTextMessage(parsed.from, aiReply, college.whatsapp)

    // ─── STEP 12: Save to history ─────────────────────────────────────────────
    await addToHistory(collegeId, parsed.from, 'user',      parsed.text)
    await addToHistory(collegeId, parsed.from, 'assistant', aiReply)

    // ─── STEP 13: Log for analytics (non-blocking) ───────────────────────────
    MessageLog.create({
      collegeId,
      userId:         parsed.from,
      studentId:      student?.studentId,
      direction:      'in',
      message:        parsed.text.slice(0, 500),  // truncate very long messages
      responseTimeMs: Date.now() - startTime,
      model:          college.ai.model,
      hadRagContext,
    }).catch(err => console.error('[Worker] Log error (non-critical):', err.message))

    console.log(`[Worker] ✅ Replied to ${parsed.from} in ${Date.now() - startTime}ms`)
  },

  { connection, concurrency: 5 }
)

// ─── ACTIVATION MESSAGE SENDER ────────────────────────────────────────────────
// Sends the initial onboarding message to each student after CSV upload
// Lower concurrency (3) to stay within WhatsApp rate limits
const activationWorker = new Worker(
  'incoming-messages',

  async (job) => {
    if (job.name !== 'send-activation') return

    const { collegeId, studentPhone, studentName, studentId } = job.data
    const college = await getCollegeConfig(collegeId)
    if (!college) return

    const firstName = studentName?.split(' ')[0] || 'Student'

    const message = `Hi ${firstName}! 👋

Aapka *${college.name}* ka WhatsApp campus assistant ready hai.

Main aapki help karunga:
• Syllabus aur timetable queries
• Exam schedules
• Attendance status
• Campus information

Shuru karne ke liye, apna *Student ID* bhejein:
Example: \`${studentId}\`

— Jodein, ${college.name} 🎓`

    await sendTextMessage(studentPhone, message, college.whatsapp)
    console.log(`[Activation] Sent to ${studentPhone} (${studentName})`)
  },

  { connection, concurrency: 3 }
)

// ─── ATTENDANCE ALERT SENDER ──────────────────────────────────────────────────
// Sends absence notifications to both student and parent
// High concurrency (10) since these are simple send operations
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

    // Format date: "2024-01-15" → "Monday, 15 January 2024"
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })

    // ─── Message to PARENT ────────────────────────────────────────────────
    const parentMessage =
`📋 *Attendance Alert — ${college.name}*

*Student:* ${studentName} (${studentId})
*Date:* ${formattedDate}
*Status:* ❌ Absent${subject ? `\n*Subject:* ${subject}` : ''}${period ? `\n*Period:* ${period}` : ''}${markedBy ? `\n*Faculty:* ${markedBy}` : ''}

Agar koi samasya hai, please apne ward se baat karein ya college se contact karein.

— Jodein, ${college.name}`

    // ─── Message to STUDENT ───────────────────────────────────────────────
    const studentMessage =
`📋 *Attendance Update*

${formattedDate} ko *${subject || 'ek class'}* mein aapki attendance absent mark ki gayi hai.${period ? ` (Period ${period})` : ''}

Agar yeh galat hai, apne faculty se confirm karein. ✅`

    // Send to parent first (most important)
    if (parentPhone) {
      await sendTextMessage(parentPhone, parentMessage, college.whatsapp)
    }

    // Send to student
    if (phone) {
      await sendTextMessage(phone, studentMessage, college.whatsapp)
    }

    console.log(`[Alert] Sent attendance alert for ${studentName} (${studentId}) at ${collegeId}`)
  },

  { connection, concurrency: 10 }
)

// ─── WORKER EVENT HANDLERS ────────────────────────────────────────────────────

worker.on('completed', job => {
  console.log(`[Worker] Job ${job.id} (${job.name}) completed`)
})

// PATTERN 13 (from Baileys MessageRetryManager):
// Only send user-facing "sorry" message on the FINAL failed attempt.
// On earlier attempts, BullMQ silently retries — user doesn't need to know.
worker.on('failed', async (job, err) => {
  const isFinalAttempt = job.attemptsMade >= (job.opts.attempts || 3)
  console.error(
    `[Worker] Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`
  )

  if (isFinalAttempt && job.name === 'process-message' && job.data?.parsed?.from) {
    try {
      await sendTextMessage(
        job.data.parsed.from,
        'Sorry, abhi Jodein mein kuch technical issue hai 🙏\nPlease thodi der baad try karein.\n\nAgar yeh baar baar ho toh apne college admin ko batayein.',
        null  // use env fallback credentials
      )
    } catch (sendErr) {
      console.error('[Worker] Could not send final-attempt fallback message:', sendErr.message)
    }
  }
})

worker.on('error', err => {
  console.error('[Worker] Worker error:', err)
})

activationWorker.on('failed', (job, err) => {
  console.error(`[ActivationWorker] Job ${job.id} failed:`, err.message)
})

attendanceWorker.on('failed', (job, err) => {
  console.error(`[AttendanceWorker] Job ${job.id} failed:`, err.message)
})
