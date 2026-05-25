// scripts/seed-college.js
// Creates LNMIIT as the first college in MongoDB.
// Run once: node scripts/seed-college.js
//
// Uses upsert — safe to run multiple times.
// Running again will UPDATE the college config (not create a duplicate).

import { connectDB } from '../src/db.js'
import { College }   from '../src/models/College.js'
import crypto        from 'crypto'
import { config }    from 'dotenv'
config()

await connectDB()

const apiKey = process.env.LNMIIT_API_KEY || crypto.randomBytes(32).toString('hex')

const lnmiit = await College.findOneAndUpdate(
  { collegeId: 'lnmiit' },
  {
    $set: {
      collegeId:  'lnmiit',
      name:       'LNM Institute of Information Technology',
      city:       'Jaipur',
      adminEmail: process.env.LNMIIT_ADMIN_EMAIL || 'admin@lnmiit.ac.in',
      apiKey,

      whatsapp: {
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || 'SET_IN_PRODUCTION',
        accessToken:   process.env.WHATSAPP_ACCESS_TOKEN    || 'SET_IN_PRODUCTION',
      },

      ai: {
        model:         'gemini-2.0-flash',
        temperature:   0.7,
        maxTokens:     500,
        contextWindow: 10,
        systemPrompt: `You are the campus assistant for LNM Institute of Information Technology (LNMIIT), Jaipur.

You help students with:
• Syllabus and subject queries
• Timetable and class schedules  
• Exam dates and patterns
• Attendance status (when data is available)
• General campus information — hostel, mess, clubs, events

Language rules:
• Respond in the SAME language the student uses — Hindi, English, or Hinglish
• If they write in Hindi, reply in Hindi. If English, reply in English.

When you don't have specific information, say:
"Iske baare mein main confirm nahi kar sakta — please apne department se verify karein."

Style: Concise, warm, like a helpful senior student. This is WhatsApp, not an email. Keep replies short.`,
      },

      features: {
        ragEnabled:       false,  // enable after uploading documents in Step 17
        attendanceAlerts: false,  // enable after ERP integration in Step 15
        webSearch:        false,
      },

      erp: { type: 'manual' },

      limits: {
        maxMessagesPerUserPerHour: 20,
        maxMessagesPerUserPerDay:  50,
      },

      status: 'active',
    }
  },
  { upsert: true, new: true }
)

console.log('\n✅ College seeded successfully:')
console.log(`   ID:     ${lnmiit.collegeId}`)
console.log(`   Name:   ${lnmiit.name}`)
console.log(`   Status: ${lnmiit.status}`)
console.log(`   API Key: ${lnmiit.apiKey}`)
console.log('\n⚠️  Save this API Key — you\'ll need it for dashboard authentication.')
console.log('   To regenerate: delete the college document and re-run this script.\n')

process.exit(0)
