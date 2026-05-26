import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { config } from 'dotenv'

config()

let connection = null
let ingestQueue = null
let ingestDLQ = null

if (process.env.BULLMQ_REDIS_URL) {
  connection = new IORedis(process.env.BULLMQ_REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  })

  const _warn = console.warn.bind(console)
  console.warn = (...args) => {
    const msg = args[0]?.toString?.() ?? ''
    if (msg.includes('Eviction policy') || msg.includes('noeviction')) return
    _warn(...args)
  }

  ingestQueue = new Queue('ingest-queue', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
        jitter: 0.2
      },
      removeOnComplete: 100,
      removeOnFail: 500
    }
  })

  ingestDLQ = new Queue('ingest-dlq', {
    connection,
    defaultJobOptions: {
      removeOnComplete: 500,
      removeOnFail: 1000
    }
  })

  console.warn = _warn
  console.log('Ingest queue and DLQ initialized (BullMQ)')
} else {
  console.log('BULLMQ_REDIS_URL not set — ingest queues disabled')
}

export { ingestQueue, ingestDLQ, connection }
