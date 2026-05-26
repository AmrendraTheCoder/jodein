/**
 * @file Attendance.js
 * @description Mongoose model representing the Attendance Ledger.
 * Logs daily attendance status (present, absent, late) for students on a per-course, per-period basis.
 * Implements compound indexing for multi-tenant isolation, duplicate prevention, and high-speed reporting.
 */

import mongoose from 'mongoose'

/**
 * @typedef {Object} Attendance
 * @property {string} collegeId Foreign key referencing the College's collegeId. Part of tenant isolation.
 * @property {string} studentId The student's unique roll number (e.g. "2022CSE001"). References Student.studentId.
 * @property {string} [courseId] Code identifying the academic course (e.g., "CS301").
 * @property {string} [subject] Title of the subject/class (e.g., "Data Structures").
 * @property {string} status Attendance status ('present', 'absent', 'late').
 * @property {number} [period] Academic class period number (e.g., 1, 2, 3).
 * @property {Date} date The calendar date of the class.
 * @property {Date} markedAt Timestamp when the attendance was recorded in the system.
 * @property {string} [markedBy] Name or identifier of the faculty member who marked the attendance.
 */

const AttendanceSchema = new mongoose.Schema({
  // ─── Tenant Isolation ───────────────────────────────────────────────────
  /**
   * Foreign key referencing the College's collegeId.
   * Isolates records to a specific tenant.
   * @type {String}
   */
  collegeId: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  // ─── Student Reference ──────────────────────────────────────────────────
  /**
   * The student's unique roll number (corresponds to Student.studentId).
   * @type {String}
   */
  studentId: {
    type: String,
    required: true,
    trim: true
  },

  // ─── Course / Subject Information ───────────────────────────────────────
  /**
   * The unique code of the course (e.g., "CS301").
   * @type {String}
   */
  courseId: {
    type: String,
    trim: true
  },

  /**
   * Human-readable title of the subject (e.g., "Data Structures").
   * @type {String}
   */
  subject: {
    type: String,
    trim: true
  },

  // ─── Attendance Details ────────────────────────────────────────────────
  /**
   * Attendance status:
   * 'present' -> Attended the class.
   * 'absent'  -> Missed the class (triggers automated alerts).
   * 'late'    -> Arrived late.
   * @type {String}
   */
  status: {
    type: String,
    required: true,
    enum: ['present', 'absent', 'late'],
    default: 'present'
  },

  /**
   * The period of the class session (e.g., 1st period, 2nd period).
   * Useful for high-granularity daily schedules.
   * @type {Number}
   */
  period: {
    type: Number,
    min: 1,
    max: 12
  },

  /**
   * The date on which the attendance is registered (YYYY-MM-DD normalized as Date).
   * @type {Date}
   */
  date: {
    type: Date,
    required: true
  },

  // ─── Metadata ───────────────────────────────────────────────────────────
  /**
   * The exact timestamp when this entry was created in the ledger.
   * @type {Date}
   */
  markedAt: {
    type: Date,
    required: true,
    default: Date.now
  },

  /**
   * Name or username of the faculty member/administrator recording the attendance.
   * @type {String}
   */
  markedBy: {
    type: String,
    trim: true
  }

}, {
  timestamps: true
})

// ─── Indexes ──────────────────────────────────────────────────────────────

/**
 * Compound unique index on { collegeId, studentId, date, period, courseId }.
 * Guarantees that a student cannot have duplicate attendance records for the exact same class/period.
 */
AttendanceSchema.index(
  { collegeId: 1, studentId: 1, date: 1, period: 1, courseId: 1 },
  { unique: true }
)

/**
 * Compound query index on { collegeId, date }.
 * Highly efficient for dashboard analytics querying day-by-day attendance trends across the college.
 */
AttendanceSchema.index({ collegeId: 1, date: -1 })

/**
 * Compound query index on { collegeId, studentId, date }.
 * Optimizes historical attendance searches for individual students (e.g., to compute attendance percentage).
 */
AttendanceSchema.index({ collegeId: 1, studentId: 1, date: -1 })

export const Attendance = mongoose.model('Attendance', AttendanceSchema)
