// src/queues/notifyQueue.js
import { Queue } from 'bullmq'
import { connection } from '../queue.js'
import { config } from 'dotenv'
config()

let notifyQueue = null

if (process.env.BULLMQ_REDIS_URL && connection) {
  // Suppress specific BullMQ warnings to keep logs clean
  const _warn = console.warn.bind(console)
  console.warn = (...args) => {
    const msg = args[0]?.toString?.() ?? ''
    if (msg.includes('Eviction policy') || msg.includes('noeviction')) return
    _warn(...args)
  }

  // Define outbound notifications queue
  notifyQueue = new Queue('outbound-notifications', {
    connection,
    defaultJobOptions: {
      attempts: 5,               // retry failed parent alerts up to 5 times
      backoff: {
        type:  'exponential',
        delay: 2000,             // 2s -> 4s -> 8s -> 16s -> 32s delay
        jitter: 0.2              // randomize retry time by +-20% to prevent thundering herd
      },
      removeOnComplete: 100,     // keep last 100 completed jobs for tracing
      removeOnFail:     500      // keep last 500 failed jobs for debugging/resending
    }
  })

  // Restore console.warn
  console.warn = _warn
  console.log('Outbound notification queue initialized (BullMQ) 🚀')
} else {
  console.log('BULLMQ_REDIS_URL not set — outbound notification queue disabled')
}

/**
 * Helper to queue an outbound parent notification job.
 * Generates a deterministic jobId to prevent duplicate notifications.
 */
export async function queueNotification(collegeId, studentId, studentName, parentPhone, date, subject, period, markedBy, templateName, templateParams = []) {
  if (!notifyQueue) {
    console.warn('[notifyQueue] Outbound queue is not initialized')
    return null
  }

  // Deterministic job ID to deduplicate: prevent multiple parent notifications for same period
  const jobId = `notify-${collegeId}-${studentId}-${date}-${period || 'all'}`

  return await notifyQueue.add('parent-attendance-broadcast', {
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
  }, {
    jobId,
  })
}

export { notifyQueue }
