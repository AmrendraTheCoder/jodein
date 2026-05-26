// src/services/erp.js
import { Student } from '../models/Student.js'
import { College } from '../models/College.js'
import { queueNotification } from '../queues/notifyQueue.js'
import { parse } from 'csv-parse/sync'
import fs from 'fs'

/**
 * Mock ERP Adapter showing how daily attendance registers sync class schedules
 * and parent mapping channels.
 */
export class MockERPAdapter {
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || 'https://mock-erp.college.edu/api/v1'
    this.apiKey = config.apiKey || 'mock-api-key-12345'
  }

  /**
   * Simulates fetching daily attendance from a college's ERP API.
   * Returns a mock register of attendance records for the given date.
   */
  async fetchDailyRegister(collegeId, date) {
    console.log(`[ERP] Fetching daily register from ERP for college: ${collegeId} on ${date}`)
    
    // In a real adapter, this would do a fetch() call to the college's ERP endpoint:
    // const res = await fetch(`${this.apiUrl}/attendance?date=${date}`, { headers: { 'Authorization': `Bearer ${this.apiKey}` } })
    // return await res.json()

    // Mock response matching Jodein's canonical attendance shape
    return [
      {
        studentId: '2022CSE001',
        subject:   'Data Structures',
        period:    2,
        status:    'absent',
        markedBy:  'Dr. Sharma',
        date
      },
      {
        studentId: '2022CSE002',
        subject:   'Data Structures',
        period:    2,
        status:    'present',
        markedBy:  'Dr. Sharma',
        date
      },
      {
        studentId: '2022CSE003',
        subject:   'Computer Networks',
        period:    3,
        status:    'absent',
        markedBy:  'Prof. Gupta',
        date
      },
      {
        studentId: '2022CSE001',
        subject:   'Computer Networks',
        period:    3,
        status:    'absent', // Absent in multiple periods
        markedBy:  'Prof. Gupta',
        date
      }
    ]
  }
}

/**
 * Core ERP Sync Service.
 * Coordinates ERP adapters, resolves parent channels, and dispatches bulk broadcasts to the notifyQueue.
 */
export async function syncERPAttendance(collegeId, date = new Date().toISOString().slice(0, 10)) {
  console.log(`[ERP Sync] Initiating daily sync for ${collegeId} on date ${date}`)

  const college = await College.findOne({ collegeId })
  if (!college) {
    throw new Error(`College config not found: ${collegeId}`)
  }

  // 1. Instantiate the correct ERP adapter (using mock for demonstration)
  const adapter = new MockERPAdapter(college.erp?.config || {})
  const registerRows = await adapter.fetchDailyRegister(collegeId, date)

  console.log(`[ERP Sync] Fetched ${registerRows.length} attendance entries from ERP`)

  let processed = 0
  let alertsQueued = 0
  let unactivatedOrNotFound = 0

  for (const row of registerRows) {
    processed++
    
    // Only queue alerts for absences
    if (row.status?.toLowerCase() !== 'absent') {
      continue
    }

    // 2. Resolve parent communication channel (maps studentId to parentPhone number)
    const student = await Student.findOne({
      collegeId,
      studentId: row.studentId,
      activated: true // Only alert parents of active/onboarded students
    })

    if (!student || !student.parentPhone) {
      unactivatedOrNotFound++
      console.log(`[ERP Sync] Student ${row.studentId} not found, unactivated, or missing parent number. Skipping notification.`)
      continue
    }

    // 3. Queue the parent broadcast to the notifyQueue
    // Using Meta templates for robust outbound delivery
    await queueNotification(
      collegeId,
      student.studentId,
      student.name,
      student.parentPhone,
      row.date,
      row.subject,
      row.period,
      row.markedBy,
      'attendance_alert', // Standard template name approved on Meta
      [
        { type: 'text', text: student.name },
        { type: 'text', text: new Date(row.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) },
        { type: 'text', text: row.subject || 'Class' },
        { type: 'text', text: row.period ? `Period ${row.period}` : 'All periods' }
      ]
    )

    alertsQueued++
  }

  console.log(`[ERP Sync] Daily sync complete for ${collegeId}. Processed: ${processed}, Alerts Queued: ${alertsQueued}, Skipped: ${unactivatedOrNotFound}`)
  
  return {
    success: true,
    processed,
    alertsQueued,
    skipped: unactivatedOrNotFound
  }
}

/**
 * Handle manual or scheduled CSV ingestion from a file and queue notifications.
 * Demonstrates parsing raw school files and mapping parent channels.
 */
export async function syncAttendanceFromCSV(collegeId, csvFilePath) {
  console.log(`[ERP Sync CSV] Processing uploaded register for ${collegeId} at ${csvFilePath}`)

  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`CSV file not found at ${csvFilePath}`)
  }

  const fileContent = fs.readFileSync(csvFilePath, 'utf-8')
  const rows = parse(fileContent, {
    columns:          true,
    skip_empty_lines: true,
    trim:             true,
    bom:              true
  })

  console.log(`[ERP Sync CSV] Parsed ${rows.length} rows from CSV`)

  let processed = 0
  let alertsQueued = 0
  let skipped = 0

  for (const row of rows) {
    processed++

    if (row.status?.toLowerCase() !== 'absent') {
      continue
    }

    const student = await Student.findOne({
      collegeId,
      studentId: row.studentId,
      activated: true
    })

    if (!student || !student.parentPhone) {
      skipped++
      continue
    }

    // Queue alert using Meta templates for parents
    await queueNotification(
      collegeId,
      student.studentId,
      student.name,
      student.parentPhone,
      row.date || new Date().toISOString().slice(0, 10),
      row.subject,
      row.period,
      row.markedBy,
      'attendance_alert',
      [
        { type: 'text', text: student.name },
        { type: 'text', text: new Date(row.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) },
        { type: 'text', text: row.subject || 'Class' },
        { type: 'text', text: row.period ? `Period ${row.period}` : 'All periods' }
      ]
    )

    alertsQueued++
  }

  // Safe file cleanup
  try { fs.unlinkSync(csvFilePath) } catch (_) {}

  console.log(`[ERP Sync CSV] Processing complete. Total rows: ${processed}, Alerts Queued: ${alertsQueued}, Skipped: ${skipped}`)

  return {
    success: true,
    processed,
    alertsQueued,
    skipped
  }
}
