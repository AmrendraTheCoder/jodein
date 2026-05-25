// src/models/MessageLog.js
// Logs every message in and out for analytics (Step 20).
// TTL index auto-deletes records older than 90 days — keeps storage lean.
// Non-blocking write: the worker does MessageLog.create().catch() without awaiting.

import mongoose from 'mongoose'

const MessageLogSchema = new mongoose.Schema({
  collegeId:      { type: String, required: true },
  userId:         { type: String, required: true },   // phone number (hashed in future)
  studentId:      { type: String },                   // set when student is activated
  direction:      { type: String, enum: ['in', 'out'] },
  message:        { type: String },                   // truncated to 500 chars if very long
  responseTimeMs: { type: Number },                   // ms from job start to reply sent
  model:          { type: String },                   // "gemini-2.0-flash", etc.
  hadRagContext:  { type: Boolean, default: false },  // did the reply use RAG?
  isActivation:   { type: Boolean, default: false },  // was this the activation message?
  error:          { type: String },                   // error message if job failed
  timestamp:      { type: Date, default: Date.now },
})

// ─── TTL Index ────────────────────────────────────────────────────────────
// MongoDB automatically deletes documents where timestamp is older than 90 days
// This is free storage hygiene — no cron job needed
// 90 days = 7,776,000 seconds
MessageLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7_776_000 })

// ─── Query Indexes ────────────────────────────────────────────────────────
// For the analytics page: get all logs for a college in a time range
MessageLogSchema.index({ collegeId: 1, timestamp: -1 })

export const MessageLog = mongoose.model('MessageLog', MessageLogSchema)
