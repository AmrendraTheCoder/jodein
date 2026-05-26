/**
 * @file Student.js
 * @description Mongoose model representing a Student in the multi-tenant campus platform.
 * Each student belongs to a specific college (tenant) and holds a unique identification (roll number/studentId).
 * Supports automatic activation via WhatsApp onboarding, parent notification linking, and verification metadata.
 */

import mongoose from 'mongoose'

/**
 * @typedef {Object} VerificationMetadata
 * @property {string} [ipAddress] The IP address from which activation was requested (if via web).
 * @property {string} [userAgent] The browser user agent from which activation was requested.
 * @property {string} [method] The activation method (e.g. 'whatsapp', 'admin_portal').
 * @property {number} [attempts] The number of attempts made to activate with this roll number.
 */

/**
 * @typedef {Object} Student
 * @property {string} collegeId Foreign key referencing the College's collegeId. Part of unique tenant indexing.
 * @property {string} studentId The college's internal unique roll number (e.g., "2022CSE001").
 * @property {string} name The student's full name.
 * @property {string} branch Academic branch (e.g., "CSE", "ECE", "Mech").
 * @property {number} year Academic year (e.g. 1, 2, 3, 4).
 * @property {string} section Academic section (e.g., "A", "B").
 * @property {string} [phone] Student's WhatsApp phone number (e.g., "919876543210"). Set upon activation.
 * @property {string} [parentPhone] Parent's WhatsApp phone number (e.g., "919876540001") for emergency/attendance alerts.
 * @property {boolean} activated Whether the student has completed self-onboarding via WhatsApp.
 * @property {Date} [activatedAt] Timestamp when the student successfully self-activated.
 * @property {VerificationMetadata} [verificationMetadata] Metadata containing information about the activation attempt and verification details.
 */

const StudentSchema = new mongoose.Schema({
  // ─── Identity & Tenant Key ──────────────────────────────────────────────
  /**
   * Foreign key referencing the College's collegeId.
   * Isolates records to a specific tenant.
   * @type {String}
   */
  collegeId: { 
    type: String, 
    required: true,
    trim: true
  },

  /**
   * The college's internal unique roll number/student identifier (e.g., "2022CSE001").
   * Highly unique within the scope of the college.
   * @type {String}
   */
  studentId: { 
    type: String, 
    required: true,
    trim: true
  },

  /**
   * Student's full name.
   * @type {String}
   */
  name: { 
    type: String,
    required: true,
    trim: true
  },

  /**
   * Academic branch (e.g., "CSE", "ECE", "Mech").
   * @type {String}
   */
  branch: { 
    type: String,
    trim: true
  },

  /**
   * Academic year (1, 2, 3, 4).
   * @type {Number}
   */
  year: { 
    type: Number,
    min: 1,
    max: 5
  },

  /**
   * Academic section (e.g., "A", "B").
   * @type {String}
   */
  section: { 
    type: String,
    trim: true
  },

  // ─── WhatsApp Identifiers ───────────────────────────────────────────────
  /**
   * Student's WhatsApp phone number formatted as E.164 without "+" (e.g., "919876543210").
   * Null until student completes activation using their student ID.
   * @type {String}
   */
  phone: { 
    type: String,
    trim: true
  },

  /**
   * Parent or guardian's WhatsApp phone number formatted as E.164 without "+" (e.g., "919876540001").
   * Used for sending real-time automated absence and performance notifications.
   * @type {String}
   */
  parentPhone: { 
    type: String,
    trim: true
  },

  // ─── Activation Status ──────────────────────────────────────────────────
  /**
   * Activation status.
   * false = student is pre-loaded via CSV but has not linked their WhatsApp yet.
   * true = student has successfully onboarded via WhatsApp.
   * @type {Boolean}
   */
  activated: { 
    type: Boolean, 
    default: false 
  },

  /**
   * Timestamp recording when the student completed activation.
   * @type {Date}
   */
  activatedAt: { 
    type: Date 
  },

  /**
   * Metadata capturing technical context about the student activation.
   */
  verificationMetadata: {
    ipAddress: { type: String },
    userAgent: { type: String },
    method: { type: String, default: 'whatsapp' },
    attempts: { type: Number, default: 0 }
  }

}, { 
  timestamps: true 
})

// ─── Indexes ──────────────────────────────────────────────────────────────

/**
 * Compound unique index on { collegeId, studentId }.
 * Prevents identical roll numbers from being registered twice in the same college.
 */
StudentSchema.index({ collegeId: 1, studentId: 1 }, { unique: true })

/**
 * Compound query index on { collegeId, phone }.
 * Optimizes the critical incoming-message path where the system resolves the student record 
 * based on the incoming WhatsApp number and college ID.
 */
StudentSchema.index({ collegeId: 1, phone: 1 })

export const Student = mongoose.model('Student', StudentSchema)
