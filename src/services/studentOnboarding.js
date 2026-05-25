// src/services/studentOnboarding.js
// Bulk student ingestion from CSV file.
//
// Usage: POST /admin/ingest-students/:collegeId with CSV file
// CSV format (share this template with colleges):
//   studentId,name,branch,year,section,phone,parentPhone
//   2022CSE001,Rahul Sharma,CSE,3,A,919876543210,919876540001
//
// Rules colleges must follow:
//   - Phone numbers with country code without + (91XXXXXXXXXX)
//   - studentId must be unique within the college
//   - CSV must be UTF-8 encoded (important for Hindi names)

import { parse }   from 'csv-parse/sync'
import fs          from 'fs'
import { Student } from '../models/Student.js'

/**
 * Ingest a student CSV file for a college.
 * Upserts each student (insert new, update existing).
 * Queues activation messages for any student not yet activated.
 *
 * Returns: { created, updated, errors, failed[] }
 */
export async function ingestStudentCSV(collegeId, csvFilePath, messageQueue) {
  console.log(`[Onboarding] Starting CSV ingestion for ${collegeId}`)

  // Read and parse CSV
  const fileContent = fs.readFileSync(csvFilePath, 'utf-8')
  const rows = parse(fileContent, {
    columns:          true,   // use first row as headers
    skip_empty_lines: true,
    trim:             true,   // strip whitespace from all values
    bom:              true,   // handle Excel UTF-8 BOM header
  })

  console.log(`[Onboarding] Parsed ${rows.length} students from CSV`)

  let created  = 0
  let updated  = 0
  let errors   = 0
  const failed = []

  for (const row of rows) {
    try {
      // Validate required fields
      if (!row.studentId || !row.phone) {
        failed.push({ row, reason: 'Missing studentId or phone' })
        errors++
        continue
      }

      // Normalize and validate phone numbers
      const phone       = normalizePhone(row.phone)
      const parentPhone = row.parentPhone ? normalizePhone(row.parentPhone) : null

      if (!phone) {
        failed.push({ row, reason: `Invalid phone format: "${row.phone}"` })
        errors++
        continue
      }

      // Upsert: insert or update without overwriting activated status
      const existing = await Student.findOne({ collegeId, studentId: row.studentId })

      const updateData = {
        name:        row.name        || existing?.name,
        branch:      row.branch      || existing?.branch,
        year:        row.year        ? parseInt(row.year) : existing?.year,
        section:     row.section     || existing?.section,
        parentPhone: parentPhone     || existing?.parentPhone,
      }

      // Only update phone if student isn't already activated
      // (don't disconnect an already-activated student)
      if (!existing?.activated) {
        updateData.phone = phone
      }

      const result = await Student.findOneAndUpdate(
        { collegeId, studentId: row.studentId },
        { $set: updateData, $setOnInsert: { collegeId, studentId: row.studentId, activated: false } },
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
        await messageQueue.add('send-activation', {
          collegeId,
          studentPhone: phone,
          studentName:  row.name,
          studentId:    row.studentId,
        }, {
          delay,
          jobId: `activation-${collegeId}-${row.studentId}`,  // dedup: won't re-queue if already exists
        })
      }

    } catch (err) {
      console.error(`[Onboarding] Error processing student ${row.studentId}:`, err.message)
      failed.push({ row, reason: err.message })
      errors++
    }
  }

  // Clean up temp file
  try { fs.unlinkSync(csvFilePath) } catch (_) {}

  const summary = { created, updated, errors, failed }
  console.log(`[Onboarding] Done for ${collegeId}:`, summary)
  return summary
}

/**
 * Normalize phone number to E.164 without + (91XXXXXXXXXX format).
 * Handles: 9876543210, +919876543210, 919876543210, 0919876543210
 */
function normalizePhone(raw) {
  const digits = raw.toString().replace(/\D/g, '')  // strip all non-digits

  if (digits.length === 10)                              return `91${digits}`    // 10-digit → add 91
  if (digits.length === 12 && digits.startsWith('91'))   return digits           // already 91XXXXXXXXXX
  if (digits.length === 13 && digits.startsWith('091'))  return digits.slice(1)  // 091XXXXXXXXXX → 91XXXXXXXXXX

  return null  // unrecognized format
}
