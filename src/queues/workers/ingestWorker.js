import { Worker } from 'bullmq'
import { connection, ingestDLQ } from '../ingestQueue.js'
import { connectDB } from '../../db.js'

// Connect to DB when worker starts
await connectDB()

console.log('[IngestWorker] Starting — connected to MongoDB ✅')

const ingestWorker = new Worker(
  'ingest-queue',
  async (job) => {
    console.log(`[IngestWorker] Processing job ${job.id} (type: ${job.name})`)
    const { collegeId, data } = job.data

    if (!collegeId) {
      throw new Error('Missing collegeId in job data')
    }

    if (job.name === 'csv-onboarding') {
      console.log(`[IngestWorker] Running CSV onboarding for college ${collegeId}`)
      if (data && data.failForTesting) {
        throw new Error('Intentional CSV onboarding failure for testing')
      }
      return { success: true, processed: data?.rowCount || 0 }
    } else if (job.name === 'document-ingest') {
      console.log(`[IngestWorker] Running document ingest for college ${collegeId}`)
      if (data && data.failForTesting) {
        throw new Error('Intentional document ingest failure for testing')
      }
      return { success: true, processed: 1 }
    } else {
      throw new Error(`Unknown job type: ${job.name}`)
    }
  },
  { connection, concurrency: 2 }
)

ingestWorker.on('failed', async (job, err) => {
  const attemptsMade = job.attemptsMade
  const maxAttempts = job.opts.attempts || 3
  const isFinalFailure = attemptsMade >= maxAttempts

  console.error(
    `[IngestWorker] Job ${job.id} failed (attempt ${attemptsMade}/${maxAttempts}): ${err.message}`
  )

  if (isFinalFailure) {
    console.error(`[IngestWorker] CRITICAL: Job ${job.id} failed completely after ${attemptsMade} attempts. Sending to Dead Letter Queue (DLQ).`)
    console.error(`🚨 ALERT: Job ${job.id} (type: ${job.name}) has failed completely! Error: ${err.message}`)

    if (ingestDLQ) {
      try {
        await ingestDLQ.add('failed-job-alert', {
          originalJobId: job.id,
          name: job.name,
          data: job.data,
          failedReason: err.message,
          attemptsMade,
          failedAt: new Date().toISOString()
        })
        console.log(`[IngestWorker] Successfully pushed job ${job.id} to Dead Letter Queue (DLQ).`)
      } catch (dlqErr) {
        console.error(`[IngestWorker] Failed to push job ${job.id} to DLQ:`, dlqErr.message)
      }
    }
  }
})

ingestWorker.on('completed', (job) => {
  console.log(`[IngestWorker] Job ${job.id} completed successfully!`)
})

ingestWorker.on('error', (err) => {
  console.error('[IngestWorker] Worker level error occurred:', err)
})

export { ingestWorker }
