// src/services/activation.js
// Handles student self-registration via WhatsApp.
//
// Flow:
//   1. Student receives activation WhatsApp from Jodein (sent via onboarding CSV)
//   2. Student replies with their student ID (e.g. "2022CSE001")
//   3. This module detects that, finds the matching Student record, links phone → student
//   4. From now on, all bot responses are personalized with student context

import { Student } from '../models/Student.js'

// ─── Student ID Detection ────────────────────────────────────────────────
// Pattern: 4-digit year + 2-4 letter branch + 3-4 digit number
// Examples: 2022CSE001, 2021ECE0023, 2023MECH001
// Adjust this regex if a college uses a different format
const STUDENT_ID_REGEX = /^[0-9]{4}[A-Z]{2,4}[0-9]{3,4}$/i

/**
 * Quick check: does this message look like a student ID?
 * Used to decide whether to attempt activation or pass to LLM.
 */
export function looksLikeStudentId(text) {
  const trimmed = text.trim().toUpperCase().replace(/\s+/g, '')
  return STUDENT_ID_REGEX.test(trimmed)
}

/**
 * Students sometimes type natural language: "My ID is 2022CSE001"
 * This extracts the ID pattern from the surrounding text.
 */
export function extractStudentId(text) {
  const match = text.toUpperCase().match(/[0-9]{4}[A-Z]{2,4}[0-9]{3,4}/)
  return match ? match[0] : text.trim().toUpperCase()
}

/**
 * Clean common student mistakes in ID input:
 *   "2022 CSE 001"    → "2022CSE001"   (spaces)
 *   "2022cse001"      → "2022CSE001"   (lowercase)
 *   "2022-CSE-001"    → "2022CSE001"   (hyphens)
 */
export function cleanStudentIdInput(text) {
  return text
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')     // remove spaces
    .replace(/[^A-Z0-9]/g, '') // remove anything that isn't alphanumeric
}

/**
 * Main activation function.
 * Finds the student record, links their phone, marks them activated.
 *
 * Returns:
 *   { success: true,  student, message }   → activation succeeded
 *   { success: true,  alreadyDone, message } → already activated
 *   { success: false, message }             → student ID not found
 */
export async function attemptActivation(collegeId, phone, studentIdAttempt) {
  // Clean and normalize the input
  const raw       = extractStudentId(studentIdAttempt)
  const studentId = cleanStudentIdInput(raw)

  // Look for the student in this college
  const student = await Student.findOne({ collegeId, studentId })

  if (!student) {
    return {
      success: false,
      message: `Student ID "${studentId}" hamari records mein nahi mila 🔍\n\nPlease check karein:\n• Exactly wahi ID bhejein jo aapke college ne diya hai\n• Example: 2022CSE001\n\nAgar problem ho toh apne college admin se contact karein.`
    }
  }

  // Already activated
  if (student.activated) {
    return {
      success:     true,
      alreadyDone: true,
      student,
      message:     `${student.name}, aapka account pehle se activate hai! ✅\n\nKoi bhi sawaal poochh sakte hain.`
    }
  }

  // Activate — link this WhatsApp phone number to the student record
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
