// src/models/College.js
// The central configuration for every college on the platform.
// Each college is a completely isolated tenant — separate WhatsApp number,
// separate system prompt, separate feature flags, separate rate limits.
//
// PATTERN 14 (from Evolution API analysis): Each college gets its own apiKey
// for dashboard authentication — per-instance key, not shared global key.

import mongoose from 'mongoose'

const CollegeSchema = new mongoose.Schema({

  // ─── Identity ───────────────────────────────────────────────────────────
  collegeId:   { type: String, required: true, unique: true },  // "lnmiit", "poornima"
  name:        { type: String, required: true },                 // "LNM Institute of IT"
  city:        { type: String },                                 // "Jaipur"
  adminEmail:  { type: String },                                 // for Step 19 dashboard login

  // PATTERN 14 (Evolution API): per-college API key for dashboard auth
  // Generate with: crypto.randomBytes(32).toString('hex')
  apiKey:      { type: String },

  // ─── WhatsApp Credentials ───────────────────────────────────────────────
  // Stored per-college so multiple colleges can use different Meta business accounts
  // In production: encrypt accessToken at rest (Step 10 covers secrets management)
  whatsapp: {
    phoneNumberId: { type: String, required: true },
    accessToken:   { type: String, required: true },
  },

  // ─── AI Configuration ───────────────────────────────────────────────────
  // Each college can have completely different bot behavior
  // PATTERN 5 (don't use a single system prompt): confirmed by Evolution API instance model
  ai: {
    model:         { type: String,  default: 'gemini-2.0-flash' },
    systemPrompt: {
      type:    String,
      default: 'You are a helpful campus assistant. Answer only academic and campus-related queries.',
    },
    temperature:   { type: Number,  default: 0.7 },
    maxTokens:     { type: Number,  default: 500 },
    contextWindow: { type: Number,  default: 10 },   // last N messages to include
  },

  // ─── Feature Toggles ────────────────────────────────────────────────────
  // Turn on/off per college — RAG only active once documents are uploaded
  features: {
    webSearch:          { type: Boolean, default: false },
    imageUnderstanding: { type: Boolean, default: false },
    voiceTranscription: { type: Boolean, default: false },
    ragEnabled:         { type: Boolean, default: false },   // Step 17-18
    attendanceAlerts:   { type: Boolean, default: false },   // Step 15-16
  },

  // ─── ERP / Attendance Integration ───────────────────────────────────────
  erp: {
    type:   { type: String, enum: ['manual', 'fedena', 'google-sheet', 'csv-email'], default: 'manual' },
    config: { type: mongoose.Schema.Types.Mixed },  // adapter-specific config
  },

  // ─── Per-User Rate Limits ────────────────────────────────────────────────
  // Overrides the global rate limit for students at this college
  limits: {
    maxMessagesPerUserPerHour: { type: Number, default: 20 },
    maxMessagesPerUserPerDay:  { type: Number, default: 50 },
  },

  // ─── Status ─────────────────────────────────────────────────────────────
  // 'draft'  → being configured, webhook not live yet
  // 'active' → live, accepting messages
  // 'paused' → temporarily suspended (worker will drop messages silently)
  status: { type: String, enum: ['active', 'paused', 'draft'], default: 'draft' },

}, { timestamps: true })

export const College = mongoose.model('College', CollegeSchema)
