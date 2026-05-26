// src/services/activation.js
// Handles student self-registration via WhatsApp.

import { Student } from '../models/Student.js'

// ─── Student ID Detection ────────────────────────────────────────────────
// Pattern: 4-digit year + 2-4 letter branch + 3-4 digit number
// Examples: 2022CSE001, 2021ECE0023, 2023MECH001
const STUDENT_ID_REGEX = /^[0-9]{4}[A-Z]{2,4}[0-9]{3,4}$/i

/**
 * @typedef {Object} ActivationResult
 * @property {boolean} success - Indicates if the operation was successful.
 * @property {boolean} [alreadyDone] - Indicates if the student was already active.
 * @property {Object} [student] - The activated Student record.
 * @property {string} message - A localized, user-friendly response message.
 */

/**
 * JSDOC: SELF-REGISTRATION ACTIVATION STATE WORKFLOW
 *
 * The conversational self-registration workflow manages a student's journey across three distinct states.
 * This state machine ensures multi-tenant isolation, data integrity, and personalized engagement.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * STATE 1: UNACTIVATED / PENDING
 * ────────────────────────────────────────────────────────────────────────────
 * - Database State: Record exists in MongoDB (`studentId` set via CSV ingestion)
 *   with `activated: false`, `phone` might be undefined or unlinked.
 * - System Action:
 *   - During CSV upload, an invite is queued under job name `send-activation` to the
 *     parent's phone or student's phone (if supplied).
 *   - The student has not verified their identity.
 * - Chat Bot Behavior:
 *   - Any incoming text message from an unlinked phone number triggers a gate check.
 *   - If the text DOES NOT look like a Student ID, the bot replies with an activation prompt,
 *     instructing the user to reply with their unique Student ID.
 *   - If the text DOES look like a Student ID, the workflow transitions to STATE 2.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * STATE 2: ATTEMPTING ACTIVATION
 * ────────────────────────────────────────────────────────────────────────────
 * - Trigger: Unactivated user sends a WhatsApp message that matches a Student ID format.
 * - System Action:
 *   - Extracts and normalizes the input (removes spaces, hyphens, converts to uppercase).
 *   - Performs a database query using BOTH `collegeId` (multi-tenant check) and `studentId`.
 * - Resolution Paths:
 *   - Path 2A: ID NOT FOUND
 *     - Bot sends a clean error message, offering examples (e.g. 2022CSE001) and directing
 *       them to their admin. Remains in STATE 1.
 *   - Path 2B: ID FOUND & ALREADY ACTIVE
 *     - Bot recognizes the identity but detects `activated: true`. Informs the user they
 *       are already set up. Transition to STATE 3.
 *   - Path 2C: ID FOUND & UNACTIVATED (Success)
 *     - System binds the sender's WhatsApp number to `Student.phone`.
 *     - Sets `activated` to `true` and updates `activatedAt` to the current timestamp.
 *     - Transitions the record to STATE 3.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * STATE 3: ACTIVATED / PERSONALIZED
 * ────────────────────────────────────────────────────────────────────────────
 * - Database State: `activated` is `true`, `phone` is bound to the verified WhatsApp ID.
 * - Chat Bot Behavior:
 *   - Future incoming messages from this phone number bypass the activation gate checks.
 *   - On every message, the worker fetches the student record using the indexed `collegeId` + `phone`.
 *   - Injects the personalized context (Name, Branch, Year, Section, Roll Number) into the
 *     system prompt for the Gemini AI model, facilitating hyper-personalized campus support.
 */

/**
 * Quick check: does this message look like a student ID?
 * Used by the worker to determine if it should intercept the message for activation.
 *
 * @param {string} text - Raw message text sent by user.
 * @returns {boolean} True if input conforms to Student ID pattern.
 */
export function looksLikeStudentId(text) {
  const trimmed = text.trim().toUpperCase().replace(/\s+/g, '')
  return STUDENT_ID_REGEX.test(trimmed)
}

/**
 * Students sometimes type natural language: "My ID is 2022CSE001".
 * This extracts the ID pattern from surrounding text.
 *
 * @param {string} text - Raw message text.
 * @returns {string} Extracted student ID pattern or the trimmed input.
 */
export function extractStudentId(text) {
  const match = text.toUpperCase().match(/[0-9]{4}[A-Z]{2,4}[0-9]{3,4}/)
  return match ? match[0] : text.trim().toUpperCase()
}

/**
 * Cleans student ID input of common mistakes (spaces, lowercase, dashes).
 * e.g., "2022-cse-001" -> "2022CSE001".
 *
 * @param {string} text - Extracted student ID.
 * @returns {string} Normalized alphanumeric student ID.
 */
export function cleanStudentIdInput(text) {
  return text
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')        // remove spaces
    .replace(/[^A-Z0-9]/g, '')  // remove non-alphanumeric chars
}

/**
 * Main activation action.
 * Maps student ID to record, links the sender's WhatsApp phone, and marks them active.
 *
 * @param {string} collegeId - College ID for multi-tenant isolation.
 * @param {string} phone - Sender's verified WhatsApp phone number.
 * @param {string} studentIdAttempt - The text containing the student ID attempt.
 * @returns {Promise<ActivationResult>} Outcome of the activation.
 */
export async function attemptActivation(collegeId, phone, studentIdAttempt) {
  // Clean and normalize the input
  const raw       = extractStudentId(studentIdAttempt)
  const studentId = cleanStudentIdInput(raw)

  // Look for the student in this specific college (multi-tenant check)
  const student = await Student.findOne({ collegeId, studentId })

  if (!student) {
    return {
      success: false,
      message: `Student ID "${studentId}" hamari records mein nahi mila 🔍\n\nPlease check karein:\n• Exactly wahi ID bhejein jo aapke college ne diya hai\n• Example: 2022CSE001\n\nAgar problem ho toh apne college admin se contact karein.`
    }
  }

  // Already activated check
  if (student.activated) {
    return {
      success:     true,
      alreadyDone: true,
      student,
      message:     `${student.name}, aapka account pehle se activate hai! ✅\n\nKoi bhi sawaal poochh sakte hain.`
    }
  }

  // State Transition from UNACTIVATED to ACTIVATED
  // Binds the active WhatsApp phone number to the student profile record
  await Student.findByIdAndUpdate(student._id, {
    phone:       phone,
    activated:   true,
    activatedAt: new Date(),
  })

  return {
    success: true,
    student,
    message: `✅ *Welcome, ${student.name}!*\n\nAapka account activate ho gaya!\n\n🎓 *${student.branch} — Year ${student.year}, Section ${student.section}*\n\nAb aap mujhse poochh sakte hain:\n• *syllabus* — semester ke subjects\n• *timetable* — class schedule\n• *attendance* — aapki attendance\n• *exams* — upcoming exam dates\n\nKya help chahiye? 😊`
  }
}
