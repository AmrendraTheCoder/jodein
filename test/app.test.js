import test from 'node:test'
import assert from 'node:assert'
import { parseIncomingMessage } from '../src/whatsapp.js'

test('parseIncomingMessage should return null for status updates', () => {
  const payload = {
    entry: [{
      changes: [{
        value: {
          statuses: [{ id: 'wamid.123', status: 'delivered' }]
        }
      }]
    }]
  }
  const result = parseIncomingMessage(payload)
  assert.strictEqual(result, null)
})

test('parseIncomingMessage should parse valid text message', () => {
  const payload = {
    entry: [{
      changes: [{
        value: {
          contacts: [{ profile: { name: 'Rahul Kumar' } }],
          messages: [{
            from: '919876543210',
            id: 'wamid.456',
            type: 'text',
            text: { body: 'hello bot' },
            timestamp: '1716712345'
          }]
        }
      }]
    }]
  }
  const result = parseIncomingMessage(payload)
  assert.deepStrictEqual(result, {
    from: '919876543210',
    messageId: 'wamid.456',
    text: 'hello bot',
    name: 'Rahul Kumar',
    timestamp: 1716712345
  })
})
