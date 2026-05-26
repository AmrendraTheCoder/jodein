import { jest } from '@jest/globals'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'

// ─── ESM JEST MOCKS ──────────────────────────────────────────────────────────

jest.unstable_mockModule('ioredis', () => {
  const mockRedis = jest.fn().mockImplementation(() => {
    return {
      ping: jest.fn().mockResolvedValue('PONG'),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      on: jest.fn(),
      defineCommand: jest.fn(),
    }
  })
  return {
    default: mockRedis
  }
})

jest.unstable_mockModule('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation(() => {
      return {
        add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
        close: jest.fn().mockResolvedValue(undefined),
      }
    }),
    Worker: jest.fn().mockImplementation(() => {
      return {
        on: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
      }
    }),
  }
})

jest.unstable_mockModule('../db.js', () => {
  return {
    connectDB: jest.fn().mockResolvedValue(true),
    isDBConnected: jest.fn().mockReturnValue(true)
  }
})

jest.unstable_mockModule('../redis.js', () => {
  return {
    redis: {
      ping: jest.fn().mockResolvedValue('PONG'),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
    },
    isMessageProcessed: jest.fn().mockResolvedValue(false),
    markMessageProcessed: jest.fn().mockResolvedValue(true),
    testRedisConnection: jest.fn().mockResolvedValue(true),
    storeDemoReply: jest.fn().mockResolvedValue(true),
    getDemoReplies: jest.fn().mockResolvedValue([]),
    getHistory: jest.fn().mockResolvedValue([]),
    addToHistory: jest.fn().mockResolvedValue(true),
    clearHistory: jest.fn().mockResolvedValue(true)
  }
})

const mockCollegeFindOne = jest.fn()
const mockCollegeFindOneAndUpdate = jest.fn()
jest.unstable_mockModule('../models/College.js', () => {
  return {
    College: {
      findOne: mockCollegeFindOne,
      findOneAndUpdate: mockCollegeFindOneAndUpdate,
    }
  }
})

const mockStudentFindOne = jest.fn()
const mockStudentFindOneAndUpdate = jest.fn()
jest.unstable_mockModule('../models/Student.js', () => {
  return {
    Student: {
      findOne: mockStudentFindOne,
      findOneAndUpdate: mockStudentFindOneAndUpdate,
    }
  }
})

jest.unstable_mockModule('../rag/query.js', () => {
  return {
    retrieveContext: jest.fn().mockResolvedValue(null)
  }
})

// ─── DYNAMIC IMPORTS ─────────────────────────────────────────────────────────
const { app } = await import('../server.js')
const { ingestStudentCSV } = await import('../services/studentOnboarding.js')
const { Student } = await import('../models/Student.js')

describe('Jodein Integration Test Suite', () => {
  const metaAppSecret = 'test_meta_app_secret'
  const verifyToken = 'test_verify_token'

  beforeAll(() => {
    process.env.NODE_ENV = 'test'
    process.env.META_APP_SECRET = metaAppSecret
    process.env.WEBHOOK_VERIFY_TOKEN = verifyToken
    process.env.ADMIN_SECRET = 'test_admin_secret'
    process.env.BULLMQ_REDIS_URL = 'redis://localhost:6379'
  })

  afterAll(async () => {
    await app.close()
  })

  describe('Webhook Handshake GET /webhook/:collegeId', () => {
    it('should successfully verify the webhook handshake with valid token', async () => {
      const challenge = '123456789'
      const response = await app.inject({
        method: 'GET',
        url: '/webhook/lnmiit',
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': verifyToken,
          'hub.challenge': challenge
        }
      })

      expect(response.statusCode).toBe(200)
      expect(response.body).toBe(challenge)
    })

    it('should fail webhook verification with invalid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/webhook/lnmiit',
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'incorrect_token',
          'hub.challenge': '123456789'
        }
      })

      expect(response.statusCode).toBe(403)
      expect(response.body).toBe('Forbidden')
    })
  })

  describe('Webhook Signature POST /webhook/:collegeId', () => {
    const validPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: '12345',
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: '123456789', phone_number_id: '98765' },
                contacts: [{ profile: { name: 'Rahul Sharma' }, wa_id: '919876543210' }],
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.HBgLOTE5ODc2NTQzMjEwFQIAERgSEzg4NDMxRjg2NThFQThEMzJFOQA=',
                    timestamp: '1672531199',
                    text: { body: 'hello' },
                    type: 'text'
                  }
                ]
              },
              field: 'messages'
            }
          ]
        }
      ]
    }

    it('should reject requests with missing x-hub-signature-256 header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhook/lnmiit',
        payload: validPayload
      })

      expect(response.statusCode).toBe(403)
      expect(response.body).toBe('Forbidden')
    })

    it('should reject requests with invalid signature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhook/lnmiit',
        headers: {
          'x-hub-signature-256': 'sha256=invalid_hash_value'
        },
        payload: validPayload
      })

      expect(response.statusCode).toBe(403)
      expect(response.body).toBe('Forbidden')
    })

    it('should successfully authenticate and accept requests with a valid signature', async () => {
      const rawPayload = JSON.stringify(validPayload)
      const expectedSignature = crypto
        .createHmac('sha256', metaAppSecret)
        .update(rawPayload, 'utf8')
        .digest('hex')

      const response = await app.inject({
        method: 'POST',
        url: '/webhook/lnmiit',
        headers: {
          'x-hub-signature-256': `sha256=${expectedSignature}`,
          'content-type': 'application/json'
        },
        payload: rawPayload
      })

      expect(response.statusCode).toBe(200)
      expect(response.body).toBe('OK')

      // Wait 50ms for asynchronous background tasks (deduplication & queueing) to complete
      await new Promise(resolve => setTimeout(resolve, 50))
    })
  })

  describe('Student CSV Loader Service', () => {
    let tempCsvPath

    beforeEach(() => {
      tempCsvPath = path.join(os.tmpdir(), `test-students-${Date.now()}.csv`)
      mockStudentFindOne.mockReset()
      mockStudentFindOneAndUpdate.mockReset()
    })

    afterEach(() => {
      try {
        if (fs.existsSync(tempCsvPath)) {
          fs.unlinkSync(tempCsvPath)
        }
      } catch (err) {}
    })

    it('should parse valid CSV data and return onboarding counts', async () => {
      const csvContent = 
`studentId,name,branch,year,section,phone,parentPhone
2022CSE001,Rahul Sharma,CSE,3,A,919876543210,919876540001
2022CSE002,Priya Singh,CSE,3,A,919876543211,919876540002`

      fs.writeFileSync(tempCsvPath, csvContent, 'utf8')

      mockStudentFindOne.mockResolvedValue(null)
      mockStudentFindOneAndUpdate.mockResolvedValue({
        activated: false,
        studentId: '2022CSE001',
        name: 'Rahul Sharma'
      })

      const mockQueue = {
        add: jest.fn().mockResolvedValue({ id: 'job-id' })
      }

      const result = await ingestStudentCSV('lnmiit', tempCsvPath, mockQueue)

      expect(result.created).toBe(2)
      expect(result.updated).toBe(0)
      expect(result.errors).toBe(0)
      expect(result.failed.length).toBe(0)
      expect(mockQueue.add).toHaveBeenCalledTimes(2)
    })

    it('should handle invalid rows in CSV gracefully by skipping and tracking errors', async () => {
      const csvContent = 
`studentId,name,branch,year,section,phone,parentPhone
,Rahul Sharma,CSE,3,A,919876543210,919876540001`

      fs.writeFileSync(tempCsvPath, csvContent, 'utf8')

      const mockQueue = {
        add: jest.fn()
      }

      const result = await ingestStudentCSV('lnmiit', tempCsvPath, mockQueue)

      expect(result.created).toBe(0)
      expect(result.errors).toBe(1)
      expect(result.failed.length).toBe(1)
      expect(result.failed[0].reason).toContain('Missing studentId or phone')
    })
  })
})
