// src/services/studentOnboarding.js
// Bulk student ingestion from CSV file using streaming.
//
// Usage: POST /admin/ingest-students/:collegeId with CSV file
// CSV format (share this template with colleges):
//   rollNumber,name,branch,year,section,phone,parentPhone
//   2022CSE001,Rahul Sharma,CSE,3,A,919876543210,919876540001
//
// Rules colleges must follow:
//   - Phone numbers with country code without + (91XXXXXXXXXX)
//   - rollNumber must be unique within the college
//   - CSV must be UTF-8 encoded (important for Hindi names)

import fs          from 'fs'
import { Student } from '../models/Student.js'
import { parseStudentCSVStream } from './csv.js'

/**
 * Ingest a student CSV file for a college using streaming parser.
 * Upserts each student (insert new, update existing).
 * Queues activation messages for any student not yet activated.
 *
 * @param {string} collegeId - College ID for multi-tenant isolation.
 * @param {string} csvFilePath - Path to the temporary CSV file.
 * @param {Object} messageQueue - BullMQ message queue.
 * @returns {Promise<{ created: number, updated: number, errors: number, failed: Array<Object> }>} Summary.
 */
export async function ingestStudentCSV(collegeId, csvFilePath, messageQueue) {
  console.log(`[Onboarding] Starting CSV ingestion for ${collegeId}`)

  let created  = 0
  let updated  = 0
  let errors   = 0
  const failed = []

  try {
    // Process student on the fly as they are streamed and mapped
    const processStudent = async (studentData) => {
      // Upsert: insert or update without overwriting activated status
      const existing = await Student.findOne({ collegeId, studentId: studentData.studentId })

      const updateData = {
        name:        studentData.name        || existing?.name,
        branch:      studentData.branch      || existing?.branch,
        year:        studentData.year        || existing?.year,
        section:     studentData.section     || existing?.section,
        parentPhone: studentData.parentPhone || existing?.parentPhone,
      }

      // Only update student's own phone if they aren't already activated
      if (!existing?.activated) {
        updateData.phone = studentData.phone || existing?.phone
      }

      const result = await Student.findOneAndUpdate(
        { collegeId, studentId: studentData.studentId },
        { $set: updateData, $setOnInsert: { collegeId, studentId: studentData.studentId, activated: false } },
        { upsert: true, new: true }
      )

      if (existing) {
        updated++
      } else {
        created++
      }

      // Queue activation message for unactivated students
      // Stagger by 200ms per student to avoid WhatsApp rate limits
      if (!result.activated && messageQueue) {
        const delay = (created + updated) * 200
        // Use student's phone if provided, otherwise fallback to parentPhone for activation invite
        const invitePhone = studentData.phone || studentData.parentPhone

        if (invitePhone) {
          await messageQueue.add('send-activation', {
            collegeId,
            studentPhone: invitePhone,
            studentName:  studentData.name,
            studentId:    studentData.studentId,
          }, {
            delay,
            jobId: `activation-${collegeId}-${studentData.studentId}`,  // dedup: won't re-queue if already exists
          })
        } else {
          console.warn(`[Onboarding] Skipping activation invite queue for ${studentData.studentId}: no phone or parentPhone`)
        }
      }
    }

    const parseResult = await parseStudentCSVStream(csvFilePath, collegeId, processStudent)
    
    // Add failed rows from parsing phase
    if (parseResult.failedRows && parseResult.failedRows.length > 0) {
      parseResult.failedRows.forEach(f => {
        failed.push(f)
        errors++
      })
    }

  } catch (err) {
    console.error(`[Onboarding] CSV stream ingestion error for ${collegeId}:`, err.message)
    errors++
    failed.push({ reason: `Stream parsing error: ${err.message}` })
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(csvFilePath) } catch (_) {}
  }

  const summary = { created, updated, errors, failed }
  console.log(`[Onboarding] Done for ${collegeId}:`, summary)
  return summary
}
