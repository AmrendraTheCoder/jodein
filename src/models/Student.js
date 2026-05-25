// src/models/Student.js
// One record per student per college.
// The compound unique index prevents duplicate student IDs within a college.
// The phone index enables fast lookup on every incoming WhatsApp message.

import mongoose from 'mongoose'

const StudentSchema = new mongoose.Schema({
  collegeId:   { type: String, required: true },   // foreign key → College.collegeId
  studentId:   { type: String, required: true },   // college's internal roll number e.g. "2022CSE001"
  name:        { type: String },
  branch:      { type: String },                   // "CSE", "ECE", "Mech"
  year:        { type: Number },                   // 1, 2, 3, 4
  section:     { type: String },                   // "A", "B"

  // WhatsApp identifiers
  // phone is set when the student activates (types their student ID in WhatsApp)
  phone:       { type: String },                   // student's WhatsApp: "919876543210"
  parentPhone: { type: String },                   // parent's WhatsApp: "919876540001"

  // Activation — false until student replies with their student ID
  // The bot flow changes completely based on this flag:
  //   false → prompt for student ID
  //   true  → answer academic questions with personalized context
  activated:   { type: Boolean, default: false },
  activatedAt: { type: Date },

}, { timestamps: true })

// ─── Indexes ──────────────────────────────────────────────────────────────
// Compound unique: same studentId cannot appear twice in the same college
StudentSchema.index({ collegeId: 1, studentId: 1 }, { unique: true })

// Phone lookup: used on every single incoming message to find the student
// This must be fast — it's in the hot path
StudentSchema.index({ collegeId: 1, phone: 1 })

export const Student = mongoose.model('Student', StudentSchema)
