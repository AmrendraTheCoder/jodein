// src/ai.js
// Gemini AI reply generation.
//
// PATTERN 8 (from Flowise RAG analysis): ragContext is injected into system prompt.
// PATTERN 15 (from LangChain RunnableSequence): the function is composable —
//   ragContext = null → pure LLM answer
//   ragContext = string → RAG-augmented answer
//
// The function signature evolves with each step:
//   Step 1-10: generateReply(history, message)
//   Step 12:   generateReply(history, message, systemPrompt, aiConfig)
//   Step 17-18: generateReply(history, message, systemPrompt, aiConfig, ragContext)
//
// Caller always gets a string back — never throws (errors return a fallback string).

import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from 'dotenv'
config()

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)

// Default system prompt — used when no college config is loaded (demo mode / fallback)
// PATTERN 5 (anti-pattern): each real college overrides this in MongoDB
const DEFAULT_SYSTEM_PROMPT = `
You are Jodein, the campus assistant for this institution.
You help students with information about their academic life.

Rules:
- Answer only questions related to academics, campus, attendance, exams, and college life
- If you don't have specific information, say clearly: "Mujhe is baare mein specific information nahi hai — please apne department se confirm karein"
- Keep answers concise — WhatsApp is not an essay platform
- Respond in the same language the student uses (Hindi, English, or Hinglish)
- Never make up course content, exam dates, or attendance data
- Be warm and friendly — like a helpful senior student, not a formal robot
`.trim()

/**
 * Generate a reply using Gemini.
 *
 * @param {Array}   history       - Chat history: [{ role: 'user'|'assistant', content: string }]
 * @param {string}  newMessage    - The student's latest message
 * @param {string}  systemPrompt  - College-specific system prompt from MongoDB
 * @param {Object}  aiConfig      - Per-college AI settings: { model, temperature, maxTokens, contextWindow }
 * @param {string|null} ragContext - Retrieved document chunks (Step 17-18), or null
 * @returns {Promise<string>}     - The bot's reply (always a string, never throws)
 */
export async function generateReply(
  history      = [],
  newMessage,
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  aiConfig     = {},
  ragContext   = null
) {
  const {
    model:         modelName    = 'gemini-2.0-flash',
    temperature                 = 0.7,
    maxTokens:     maxOutputTokens = 500,
    contextWindow               = 10,
  } = aiConfig

  try {
    // ─── Build system prompt with optional RAG context ──────────────────────
    // PATTERN 8: RAG context is prepended to system prompt, not injected mid-conversation.
    // This is the pattern confirmed by Flowise's ConversationalRetrievalToolAgent source.
    let fullSystemPrompt = systemPrompt

    if (ragContext) {
      fullSystemPrompt = `${systemPrompt}

---
RELEVANT INFORMATION FROM COLLEGE DOCUMENTS:
${ragContext}
---

Use the above document excerpts to answer the student's question accurately.
If the answer is clearly in the documents, use that information.
If the question is not covered by the documents, answer from your general knowledge but note any uncertainty.
If you're unsure, say: "Is baare mein mere paas specific document nahi hai — please department se confirm karein."`
    }

    // ─── Trim history to context window ──────────────────────────────────────
    // Only include the last N messages to keep token usage bounded
    const trimmedHistory = history.slice(-contextWindow)

    // Convert history from Jodein format to Gemini format
    // Jodein: { role: 'assistant' }  →  Gemini: { role: 'model' }
    const formattedHistory = trimmedHistory.map(msg => ({
      role:  msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }))

    // ─── Call Gemini ────────────────────────────────────────────────────────
    const geminiModel = genAI.getGenerativeModel({ model: modelName })

    const chat = geminiModel.startChat({
      history:          formattedHistory,
      generationConfig: { maxOutputTokens, temperature },
      systemInstruction: fullSystemPrompt,
    })

    const result   = await chat.sendMessage(newMessage)
    const response = await result.response
    const text     = response.text()

    return text

  } catch (err) {
    console.error('[AI] Gemini error:', err.message)
    // Return a friendly fallback — never let the user see an empty response
    return 'Sorry, abhi mujhe reply karne mein problem ho rahi hai 🙏 Please thodi der baad try karein.'
  }
}
