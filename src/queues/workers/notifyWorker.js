// src/queues/workers/notifyWorker.js
import { Worker } from 'bullmq'
import { connection } from '../../queue.js'
import { connectDB } from '../../db.js'
import { getCollegeConfig } from '../../configCache.js'
import { sendTemplateMessage } from '../../whatsapp.js'
import { MessageLog } from '../../models/MessageLog.js'
import { config } from 'dotenv'

config()

// Connect to MongoDB when the worker starts
await connectDB()

console.log('[NotifyWorker] Starting — connected to MongoDB ✅')

// Outbound notifications worker
// Concurrency is set to 5 as requested to optimize throughput safely
const notifyWorker = new Worker(
  'outbound-notifications',

  async (job) => {
    if (job.name !== 'parent-attendance-broadcast') return

    const {
      collegeId,
      studentId,
      studentName,
      parentPhone,
      date,
      subject,
      period,
      markedBy,
      templateName,
      templateParams
    } = job.data

    const startTime = Date.now()
    console.log(`[NotifyWorker] Processing attendance broadcast for student: ${studentName} (${studentId}) to parent phone: ${parentPhone}`)

    // 1. Fetch college config
    const college = await getCollegeConfig(collegeId)
    if (!college) {
      console.warn(`[NotifyWorker] No active config for college: ${collegeId} — dropping notification`)
      return
    }

    // 2. Format the date nicely for fallback or logs
    const formattedDate = new Date(date).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // 3. Construct parameters for Meta WhatsApp Template API if not already provided
    // Expected template body parameters:
    // {{1}} = Student Name
    // {{2}} = Formatted Date
    // {{3}} = Subject (or "Class")
    // {{4}} = Period (or "All periods")
    let parameters = templateParams
    if (!parameters || parameters.length === 0) {
      parameters = [
        { type: 'text', text: studentName },
        { type: 'text', text: formattedDate },
        { type: 'text', text: subject || 'Class' },
        { type: 'text', text: period ? `Period ${period}` : 'All periods' }
      ]
    }

    // 4. Use the custom sendTemplateMessage function from whatsapp.js
    // Accepts credentials for multi-college WhatsApp accounts
    const result = await sendTemplateMessage(
      parentPhone,
      templateName || 'attendance_alert',
      'en_US', // standard default language
      parameters,
      college.whatsapp
    )

    if (!result.success) {
      throw new Error(`Failed to send Meta template message: ${JSON.stringify(result.error || result.data)}`)
    }

    // 5. Log outbound message to MessageLog for analytics and traceability
    // PATTERN 12 (WAHA): log collegeId on every operation for traceability
    const paramString = parameters.map(p => p.text).join(', ')
    await MessageLog.create({
      collegeId,
      userId: parentPhone,
      studentId,
      direction: 'out',
      message: `[Template: ${templateName || 'attendance_alert'}] Params: ${paramString}`,
      responseTimeMs: Date.now() - startTime,
      model: 'template-delivery',
      hadRagContext: false,
      isActivation: false
    }).catch(err => console.error('[NotifyWorker] Logging failed:', err.message))

    console.log(`[NotifyWorker] ✅ Successfully sent attendance notification to parent: ${parentPhone} for student: ${studentName}`)
  },

  {
    connection,
    concurrency: 5 // Optimize throughput safely with concurrency 5
  }
)

// Worker event handlers
notifyWorker.on('completed', (job) => {
  console.log(`[NotifyWorker] Job ${job.id} completed`)
})

notifyWorker.on('failed', (job, err) => {
  console.error(`[NotifyWorker] Job ${job.id} failed (attempts: ${job.attemptsMade}): ${err.message}`)
})

notifyWorker.on('error', (err) => {
  console.error('[NotifyWorker] Worker encountered error:', err)
})

export { notifyWorker }
