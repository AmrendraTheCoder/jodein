// src/rag/ingest.js
// Document ingestion pipeline: PDF/text → chunks → embeddings → Qdrant.
//
// PATTERN 8 (from Flowise ConversationalRetrievalToolAgent analysis):
// Each college gets its own Qdrant collection namespace: "jodein-{collegeId}"
// This guarantees LNMIIT documents can never leak into Poornima's responses.
//
// PATTERN 15 (from LangChain RunnableSequence analysis):
// The pipeline is: extract text → create document → embed → store
// Each step is composable and independently testable.

import fs from 'fs'
import path from 'path'

// ─── Collection name factory ──────────────────────────────────────────────
// Each college gets a separate Qdrant collection — full tenant isolation
export function collectionName(collegeId) {
  return `jodein-${collegeId}`
}

/**
 * Ingest a document into Qdrant for a specific college.
 *
 * @param {string} collegeId        - The college identifier
 * @param {string} filePath         - Absolute path to the file (PDF or .txt/.md)
 * @param {string} documentTitle    - Human-readable title for the document
 * @returns {{ success: boolean, documentTitle: string, chunks: number }}
 */
export async function ingestDocument(collegeId, filePath, documentTitle) {
  console.log(`[RAG] Starting ingestion: "${documentTitle}" for ${collegeId}`)

  // ─── STEP 1: Extract text ────────────────────────────────────────────────
  let text
  const ext = path.extname(filePath).toLowerCase()

  if (ext === '.pdf') {
    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js')
    const dataBuffer = fs.readFileSync(filePath)
    const pdfData    = await pdfParse(dataBuffer)
    text             = pdfData.text
  } else {
    // Plain text, markdown, etc.
    text = fs.readFileSync(filePath, 'utf-8')
  }

  if (!text || text.trim().length < 100) {
    throw new Error(
      'Document appears empty or unreadable. ' +
      'If this is a scanned PDF (image-based), it needs OCR first. ' +
      'Try a text-based PDF or export from the source software.'
    )
  }

  console.log(`[RAG] Extracted ${text.length} characters from "${documentTitle}"`)

  // ─── STEP 2-5: LlamaIndex handles chunking → embedding → storing ─────────
  const { Document, VectorStoreIndex } = await import('llamaindex')

  // Lazy import Qdrant + Google embedding (heavy deps — only load when needed)
  const { QdrantVectorStore }             = await import('@llamaindex/qdrant')
  const { GoogleGenerativeAIEmbedding }   = await import('@llamaindex/google')

  const document = new Document({
    text,
    metadata: {
      collegeId,
      title:      documentTitle,
      source:     path.basename(filePath),
      ingestedAt: new Date().toISOString(),
    },
  })

  const embedModel = new GoogleGenerativeAIEmbedding({
    model:  'text-embedding-004',
    apiKey: process.env.GOOGLE_AI_API_KEY,
  })

  const vectorStore = new QdrantVectorStore({
    url:            process.env.QDRANT_URL || 'http://localhost:6333',
    apiKey:         process.env.QDRANT_API_KEY || undefined,
    collectionName: collectionName(collegeId),
  })

  // VectorStoreIndex.fromDocuments: chunks → embeds → stores everything atomically
  // Default chunk size: 1024 tokens (good for academic documents)
  await VectorStoreIndex.fromDocuments([document], {
    vectorStore,
    embedModel,
  })

  console.log(`[RAG] ✅ Ingestion complete: "${documentTitle}" stored in collection "${collectionName(collegeId)}"`)

  return { success: true, documentTitle }
}
