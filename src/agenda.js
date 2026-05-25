// src/agenda.js
// MongoDB-backed cron scheduler for attendance polling.
//
// Why Agenda over BullMQ's repeat feature?
//   - Agenda stores job schedules IN MongoDB — survives server restarts
//   - BullMQ repeats require Redis to be alive and correctly configured
//   - Agenda's job history is visible in MongoDB (easy to query)
//   - For attendance polling (every 30min), MongoDB durability is more important
//     than Redis speed
//
// PATTERN 3 (from BullMQ JobScheduler analysis): For attendance alerts themselves
// we still use BullMQ (fast delivery to students/parents). Agenda only schedules
// the polling trigger — not the alert sending.

import { Agenda } from '@hokify/agenda'
import { config } from 'dotenv'
import { College } from './models/College.js'
import { getERPAdapter } from './erp-adapters/index.js'
config()

let agendaInstance = null

export async function startAgenda(messageQueue) {
  if (!process.env.MONGODB_URI) {
    console.warn('[Agenda] MONGODB_URI not set — scheduler disabled')
    return
  }

  agendaInstance = new Agenda({
    db:           { address: process.env.MONGODB_URI, collection: 'agendaJobs' },
    processEvery: '1 minute',
    defaultConcurrency: 2,
  })

  // ─── Job: Poll ERP for attendance data ──────────────────────────────────
  agendaInstance.define('poll-attendance', { concurrency: 1 }, async (job) => {
    const { collegeId } = job.attrs.data
    console.log(`[Agenda] Polling attendance for ${collegeId}`)

    // Get the college config
    const college = await College.findOne({ collegeId, status: 'active' })
    if (!college || !college.features.attendanceAlerts) {
      console.log(`[Agenda] Skipping ${collegeId} — attendance alerts disabled`)
      return
    }

    // Use the appropriate ERP adapter based on college config
    const adapter = getERPAdapter(college)
    const absents = await adapter.fetchTodayAbsents(collegeId)

    if (!absents || absents.length === 0) {
      console.log(`[Agenda] No absents found for ${collegeId}`)
      return
    }

    console.log(`[Agenda] Found ${absents.length} absents for ${collegeId} — queueing alerts`)

    // Queue attendance alerts for each absent student
    for (const absent of absents) {
      const { Student } = await import('./models/Student.js')
      const student = await Student.findOne({
        collegeId,
        studentId: absent.studentId,
        activated: true,
      })

      if (!student) continue

      const jobId = `attend-${collegeId}-${absent.studentId}-${absent.date}-${absent.period || 'all'}`
      await messageQueue.add('attendance-alert', {
        collegeId,
        studentId:   student.studentId,
        studentName: student.name,
        phone:       student.phone,
        parentPhone: student.parentPhone,
        ...absent,
      }, { jobId })
    }
  })

  await agendaInstance.start()

  // ─── Schedule attendance polling for all active colleges ────────────────
  // Poll every 30 minutes for colleges with ERP integrations
  const activeColleges = await College.find({
    status: 'active',
    'features.attendanceAlerts': true,
    'erp.type': { $ne: 'manual' },  // manual colleges upload CSV — no polling needed
  })

  for (const college of activeColleges) {
    await agendaInstance.every('30 minutes', 'poll-attendance', {
      collegeId: college.collegeId
    })
    console.log(`[Agenda] Scheduled attendance polling for: ${college.collegeId}`)
  }

  console.log(`[Agenda] Started — monitoring ${activeColleges.length} colleges`)
}

export function getAgenda() {
  return agendaInstance
}
