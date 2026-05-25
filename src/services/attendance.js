// src/services/attendance.js
// Attendance data ingestion and alert queuing.
//
// This is the feature that sells Jodein to college admins.
// When a student is marked absent, their parent gets a WhatsApp alert in minutes.
//
// Expected CSV format (share this template with college IT teams):
//   date,studentId,subject,period,status,markedBy
//   2024-01-15,2022CSE001,Data Structures,2,absent,Dr. Sharma
//   2024-01-15,2022CSE002,Data Structures,2,present,Dr. Sharma

import { parse }   from 'csv-parse/sync'
import fs          from 'fs'
import { Student } from '../models/Student.js'

/**
 * Parse an attendance CSV and queue WhatsApp alerts for all absent students.
 * Only activated students (who have linked their phone) will receive alerts.
 * Parents only get alerts if parentPhone is set on the student record.
 *
 * Returns: { alertsQueued, studentsNotFound, alreadyPresent }
 */
export async function ingestAttendanceCSV(collegeId, csvFilePath, messageQueue) {
  console.log(`[Attendance] Starting CSV ingestion for ${collegeId}`)

  const fileContent = fs.readFileSync(csvFilePath, 'utf-8')
  const rows = parse(fileContent, {
    columns:          true,
    skip_empty_lines: true,
    trim:             true,
    bom:              true,
  })

  console.log(`[Attendance] Parsed ${rows.length} attendance records`)

  let alertsQueued       = 0
  let studentsNotFound   = 0
  let alreadyPresent     = 0
  const unresolved       = []

  for (const row of rows) {
    // Only process absences — no point alerting for present
    if (!row.status || row.status.toLowerCase() !== 'absent') {
      alreadyPresent++
      continue
    }

    if (!row.studentId) {
      unresolved.push({ row, reason: 'Missing studentId' })
      continue
    }

    // Find the activated student — unactivated students don't have phones linked
    const student = await Student.findOne({
      collegeId,
      studentId:  row.studentId,
      activated:  true,         // must be activated to have phone
    })

    if (!student) {
      studentsNotFound++
      unresolved.push({ row, reason: 'Student not found or not activated' })
      continue
    }

    // Queue the attendance alert
    // jobId is deterministic — prevents duplicate alerts for same class period
    const jobId = `attend-${collegeId}-${row.studentId}-${row.date || 'today'}-${row.period || 'all'}`

    if (messageQueue) {
      await messageQueue.add('attendance-alert', {
        collegeId,
        studentId:   student.studentId,
        studentName: student.name,
        phone:       student.phone,
        parentPhone: student.parentPhone,
        date:        row.date    || new Date().toISOString().slice(0, 10),
        subject:     row.subject || null,
        period:      row.period  || null,
        markedBy:    row.markedBy || null,
      }, {
        jobId,  // BullMQ deduplication — same period can't be alerted twice
      })
      alertsQueued++
    }
  }

  // Clean up temp file
  try { fs.unlinkSync(csvFilePath) } catch (_) {}

  const summary = { alertsQueued, studentsNotFound, alreadyPresent, unresolved }
  console.log(`[Attendance] Done for ${collegeId}:`, { alertsQueued, studentsNotFound })
  return summary
}
