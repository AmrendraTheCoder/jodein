// src/erp-adapters/index.js
// ERP adapter registry.
// Every college has a different attendance system — you build one adapter per type.
// This file picks the right adapter based on the college's erp.type config.
//
// Currently shipped adapters:
//   manual       → college uploads CSV manually via dashboard (default)
//
// Planned adapters (add as you onboard colleges with these systems):
//   google-sheet → college pastes attendance into a shared Google Sheet
//   fedena       → college uses Fedena ERP (REST API adapter)
//   csv-email    → college emails a CSV file to a monitored address

export function getERPAdapter(college) {
  const erpType = college.erp?.type || 'manual'

  switch (erpType) {
    case 'google-sheet': return new GoogleSheetAdapter(college.erp?.config)
    case 'fedena':       return new FedenaAdapter(college.erp?.config)
    case 'csv-email':    return new CSVEmailAdapter(college.erp?.config)
    case 'manual':
    default:             return new ManualAdapter(college.erp?.config)
  }
}

// ─── ManualAdapter ───────────────────────────────────────────────────────
// The default — used by colleges that upload CSV manually via the dashboard.
// No automatic polling — alerts are triggered by CSV upload.
class ManualAdapter {
  constructor(config) {
    this.config = config
  }

  async fetchTodayAbsents(collegeId) {
    // Manual mode: nothing to poll
    // Attendance comes from CSV upload via POST /admin/ingest-attendance/:collegeId
    return []
  }
}

// ─── GoogleSheetAdapter ──────────────────────────────────────────────────
// For colleges that paste attendance into a shared Google Sheet daily.
// The Agenda job polls this sheet every 30 minutes.
// Install when needed: npm install google-spreadsheet
class GoogleSheetAdapter {
  constructor(config) {
    this.sheetId = config?.sheetId
    this.apiKey  = config?.apiKey
  }

  async fetchTodayAbsents(collegeId) {
    // TODO: implement when a college requests this integration
    // import { GoogleSpreadsheet } from 'google-spreadsheet'
    // const doc = new GoogleSpreadsheet(this.sheetId)
    // await doc.useApiKey(this.apiKey)
    // ... filter today's rows with status === 'absent'
    console.warn('[GoogleSheetAdapter] Not yet implemented — returning empty')
    return []
  }
}

// ─── FedenaAdapter ───────────────────────────────────────────────────────
// For colleges using the open-source Fedena ERP system.
class FedenaAdapter {
  constructor(config) {
    this.baseUrl = config?.baseUrl
    this.token   = config?.token
  }

  async fetchTodayAbsents(collegeId) {
    // TODO: implement Fedena REST API polling
    // Reference: https://github.com/projectfedena/fedena
    console.warn('[FedenaAdapter] Not yet implemented — returning empty')
    return []
  }
}

// ─── CSVEmailAdapter ─────────────────────────────────────────────────────
// For colleges that email a CSV every day to a monitored inbox.
class CSVEmailAdapter {
  constructor(config) {
    this.email = config?.monitoredEmail
  }

  async fetchTodayAbsents(collegeId) {
    // TODO: implement email monitoring (IMAP + attachment parsing)
    console.warn('[CSVEmailAdapter] Not yet implemented — returning empty')
    return []
  }
}
