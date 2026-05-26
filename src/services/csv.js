// src/services/csv.js
// Core CSV streaming parser for bulk student onboarding.
// Validates headers: rollNumber, name, branch, year, parentPhone.
// Gracefully skips malformed rows and logs warnings.

import { parse } from 'csv-parse'
import fs from 'fs'

/**
 * Normalizes phone numbers to E.164 without + (91XXXXXXXXXX format).
 * Handles: 9876543210, +919876543210, 919876543210, 0919876543210
 *
 * @param {string|number} raw - The raw phone number input.
 * @returns {string|null} The normalized phone number or null if invalid.
 */
export function normalizePhone(raw) {
  if (!raw) return null
  const digits = raw.toString().replace(/\D/g, '')  // strip all non-digits

  if (digits.length === 10)                              return `91${digits}`    // 10-digit → add 91
  if (digits.length === 12 && digits.startsWith('91'))   return digits           // already 91XXXXXXXXXX
  if (digits.length === 13 && digits.startsWith('091'))  return digits.slice(1)  // 091XXXXXXXXXX → 91XXXXXXXXXX

  return null  // unrecognized format
}

/**
 * Core CSV streaming parser for onboarding students.
 * Reads student CSV data, validates required headings, maps them to Student records,
 * and executes a processor callback sequentially with backpressure handling.
 *
 * @param {string} csvFilePath - Absolute path to the CSV file.
 * @param {string} collegeId - College ID for multi-tenant isolation.
 * @param {function(Object): Promise<void>} onStudent - Async callback to process each mapped student.
 * @returns {Promise<{ parsedCount: number, skippedCount: number, failedRows: Array<{row: Object, reason: string}> }>} Parsing execution summary.
 */
export async function parseStudentCSVStream(csvFilePath, collegeId, onStudent) {
  if (!collegeId) {
    throw new Error('collegeId is required for parsing')
  }

  const fileStream = fs.createReadStream(csvFilePath)
  const parser = fileStream.pipe(parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }))

  let headersValidated = false
  let parsedCount = 0
  let skippedCount = 0
  const failedRows = []

  parser.on('headers', (headers) => {
    const required = ['rollNumber', 'name', 'branch', 'year', 'parentPhone']
    const missing = required.filter(h => !headers.includes(h))
    if (missing.length > 0) {
      parser.destroy(new Error(`Missing required CSV columns: ${missing.join(', ')}`))
    } else {
      headersValidated = true
    }
  })

  try {
    for await (const row of parser) {
      try {
        if (!row.rollNumber) {
          console.warn(`[CSV Parser] Skipping row: Missing rollNumber`, row)
          failedRows.push({ row, reason: 'Missing rollNumber' })
          skippedCount++
          continue
        }

        if (!row.name) {
          console.warn(`[CSV Parser] Skipping row: Missing name for rollNumber ${row.rollNumber}`, row)
          failedRows.push({ row, reason: 'Missing name' })
          skippedCount++
          continue
        }

        const parentPhone = normalizePhone(row.parentPhone)
        if (!parentPhone) {
          console.warn(`[CSV Parser] Skipping row: Invalid parentPhone "${row.parentPhone}" for rollNumber ${row.rollNumber}`)
          failedRows.push({ row, reason: `Invalid parentPhone format: ${row.parentPhone}` })
          skippedCount++
          continue
        }

        const year = parseInt(row.year, 10)
        if (isNaN(year)) {
          console.warn(`[CSV Parser] Skipping row: Invalid year "${row.year}" for rollNumber ${row.rollNumber}`)
          failedRows.push({ row, reason: `Invalid year format: ${row.year}` })
          skippedCount++
          continue
        }

        // Section can be optional, default to 'A'
        const section = row.section ? row.section.trim() : 'A'

        // Optional student phone
        const phone = row.phone ? normalizePhone(row.phone) : null

        // Map to Student schema fields
        const studentData = {
          collegeId,
          studentId: row.rollNumber.trim().toUpperCase(),
          name: row.name.trim(),
          branch: row.branch ? row.branch.trim() : '',
          year,
          section,
          parentPhone,
          phone,
          activated: false,
        }

        // Process student record through callback (e.g. database upsert and queueing)
        await onStudent(studentData)
        parsedCount++
      } catch (err) {
        console.error(`[CSV Parser] Error processing row for rollNumber ${row?.rollNumber || 'unknown'}:`, err.message)
        failedRows.push({ row, reason: err.message })
        skippedCount++
      }
    }
  } catch (err) {
    // Parser was destroyed or read stream failed
    throw err
  }

  if (!headersValidated) {
    throw new Error('CSV headers could not be validated or file is empty')
  }

  return { parsedCount, skippedCount, failedRows }
}
