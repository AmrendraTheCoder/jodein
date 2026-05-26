// scripts/load-test.js
// Basic load testing framework to test Fastify server throughput and responsiveness

import { config } from 'dotenv'
config()

const port = process.env.PORT || 3000
const targetUrl = `http://localhost:${port}/health`

console.log(`[Load Test] Starting throughput test against ${targetUrl}...`)

const runLoadTest = async () => {
  const start = Date.now()
  const requests = 50
  const promises = []

  for (let i = 0; i < requests; i++) {
    promises.push(
      fetch(targetUrl)
        .then(res => ({ ok: res.ok, status: res.status }))
        .catch(err => ({ ok: false, error: err.message }))
    )
  }

  const results = await Promise.all(promises)
  const duration = Date.now() - start

  const successful = results.filter(r => r.ok).length
  const failed = requests - successful

  console.log('\n📊 Load Test Results:')
  console.log(`   Total Requests: ${requests}`)
  console.log(`   Successful:     ${successful} ✅`)
  console.log(`   Failed:         ${failed} ❌`)
  console.log(`   Total Duration: ${duration}ms`)
  console.log(`   Avg Request:    ${(duration / requests).toFixed(2)}ms`)
  console.log(`   Throughput:     ${((requests / duration) * 1000).toFixed(2)} req/sec\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

runLoadTest().catch(err => {
  console.error('[Load Test] Error during load test:', err)
  process.exit(1)
})
