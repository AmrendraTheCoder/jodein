// src/routes/admin.js
// Decoupled admin and ingestion routes protected by x-admin-secret.

import os from 'os'
import path from 'path'
import fs from 'fs'
import { College } from '../models/College.js'
import { invalidateCache } from '../configCache.js'

function validateAdminSecret(req, reply) {
  const secret = req.headers['x-admin-secret']
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    reply.status(401).send({ error: 'Unauthorized — provide valid x-admin-secret header' })
    return false
  }
  return true
}

export default async function adminRoutes(fastify, options) {
  
  // Protect all routes inside this plugin block
  fastify.addHook('preHandler', async (req, reply) => {
    if (!validateAdminSecret(req, reply)) return
  })

  // ─── POST /admin/ingest-students/:collegeId ────────────────────────────────
  fastify.post('/ingest-students/:collegeId', async (req, reply) => {
    const { collegeId } = req.params
    const file          = await req.file()

    if (!file) return reply.status(400).send({ error: 'No file uploaded' })

    const tempPath = path.join(os.tmpdir(), `students-${collegeId}-${Date.now()}.csv`)
    const buffer   = await file.toBuffer()
    fs.writeFileSync(tempPath, buffer)

    const { ingestStudentCSV } = await import('../services/studentOnboarding.js')
    const { messageQueue }     = await import('../queue.js')

    ingestStudentCSV(collegeId, tempPath, messageQueue)
      .then(r  => fastify.log.info(`[Admin] Student ingestion done for ${collegeId}: ${JSON.stringify(r)}`))
      .catch(e => fastify.log.error(`[Admin] Student ingestion failed for ${collegeId}: ${e.message}`))

    return reply.send({
      message:  'CSV ingestion started — processing in background',
      collegeId,
      filename: file.filename,
    })
  })

  // ─── POST /admin/ingest-attendance/:collegeId ──────────────────────────────
  fastify.post('/ingest-attendance/:collegeId', async (req, reply) => {
    const { collegeId } = req.params
    const file          = await req.file()

    if (!file) return reply.status(400).send({ error: 'No file uploaded' })

    const tempPath = path.join(os.tmpdir(), `attendance-${collegeId}-${Date.now()}.csv`)
    const buffer   = await file.toBuffer()
    fs.writeFileSync(tempPath, buffer)

    const { ingestAttendanceCSV } = await import('../services/attendance.js')
    const { messageQueue }        = await import('../queue.js')

    ingestAttendanceCSV(collegeId, tempPath, messageQueue)
      .then(r  => fastify.log.info(`[Admin] Attendance ingestion done for ${collegeId}: ${JSON.stringify(r)}`))
      .catch(e => fastify.log.error(`[Admin] Attendance ingestion failed for ${collegeId}: ${e.message}`))

    return reply.send({
      message:  'Attendance CSV ingestion started — absence alerts queued in background',
      collegeId,
      filename: file.filename,
    })
  })

  // ─── POST /admin/ingest-document/:collegeId ────────────────────────────────
  fastify.post('/ingest-document/:collegeId', async (req, reply) => {
    const { collegeId } = req.params
    const file          = await req.file()

    if (!file) return reply.status(400).send({ error: 'No file uploaded' })

    const title    = req.headers['x-document-title'] || file.filename
    const tempPath = path.join(os.tmpdir(), `doc-${collegeId}-${Date.now()}-${file.filename}`)
    const buffer   = await file.toBuffer()
    fs.writeFileSync(tempPath, buffer)

    const { ingestDocument } = await import('../rag/ingest.js')

    ingestDocument(collegeId, tempPath, title)
      .then(r  => fastify.log.info(`[Admin] RAG ingestion done for ${collegeId}: ${JSON.stringify(r)}`))
      .catch(e => fastify.log.error(`[Admin] RAG ingestion failed for ${collegeId}: ${e.message}`))

    return reply.send({
      message:    'Document ingestion started — chunks will appear shortly',
      collegeId,
      title,
      filename:   file.filename,
    })
  })

  // ─── PATCH /admin/college/:collegeId/config ────────────────────────────────
  fastify.patch('/college/:collegeId/config', async (req, reply) => {
    const { collegeId } = req.params
    const updates       = req.body

    if (!updates || Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: 'No updates provided' })
    }

    const college = await College.findOneAndUpdate(
      { collegeId },
      { $set: updates },
      { new: true }
    )

    if (!college) return reply.status(404).send({ error: `College not found: ${collegeId}` })

    // Invalidate local memory cache immediately
    invalidateCache(collegeId)

    return reply.send({ message: 'Config updated', collegeId, updated: Object.keys(updates) })
  })
}
