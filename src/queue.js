// src/queue.js
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { config } from 'dotenv'
config()

// Guard: if BULLMQ_REDIS_URL is not set, don't attempt any connection.
// This allows the server to boot in DEMO_MODE without a BullMQ Redis instance.
// The queue is only created when the URL is available (production mode).
let messageQueue = null
let connection   = null

if (process.env.BULLMQ_REDIS_URL) {
  // Parse the Redis URL for BullMQ
  connection = new IORedis(process.env.BULLMQ_REDIS_URL, {
    maxRetriesPerRequest: null,  // required by BullMQ
    enableReadyCheck:     false, // required by BullMQ
    lazyConnect:          true,  // don't connect until first use
  })

  // The queue — messages wait here to be processed
  messageQueue = new Queue('incoming-messages', {
    connection,
    defaultJobOptions: {
      attempts:    3,            // retry failed jobs up to 3 times
      backoff: {
        type:   'exponential',
        delay:  1000,            // 1s → 2s → 4s between retries
        // PATTERN 2 (from bullmq/src/classes/backoffs.ts analysis):
        // jitter randomizes retry time by ±20% to prevent thundering herd:
        // when multiple jobs fail at once, they don't all retry simultaneously
        // Formula: Math.floor(Math.random() * maxDelay * jitter + minDelay)
        jitter: 0.2
      },
      removeOnComplete: 100,     // keep last 100 completed jobs for debugging
      removeOnFail:     500      // keep last 500 failed jobs for investigation
    }
  })

  console.log('Message queue initialized (BullMQ)')
} else {
  console.log('BULLMQ_REDIS_URL not set — queue disabled (demo mode or missing config)')
}

export { messageQueue, connection }
