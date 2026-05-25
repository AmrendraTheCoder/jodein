// src/rag/query.js
// RAG retrieval pipeline: query → embed → Qdrant search → filter → return context.
//
// PATTERN 8 (from Flowise 3-step RAG analysis):
//   Step 1 — REPHRASE:  done in ai.js (chat history + question → standalone question)
//   Step 2 — RETRIEVE:  this file (embed query → find similar chunks)
//   Step 3 — RESPOND:   done in ai.js (inject context into system prompt → Gemini)
//
// The key insight from Flowise source: without rephrase, "What about the fees?"
// after "Tell me about CSE" returns nothing useful from the vector DB.
// The worker must rephrase before calling retrieveContext().
//
// This file only handles Step 2: given a standalone question, find relevant chunks.

import { collectionName } from './ingest.js'

// Minimum similarity score to include a chunk in the context.
// Below 0.70 → document is probably irrelevant → don't include → LLM answers from memory.
// Tune this down to 0.60 if you're getting too many "not found" for real questions.
const SIMILARITY_THRESHOLD = 0.70

/**
 * Retrieve relevant document chunks for a query from Qdrant.
 *
 * @param {string} collegeId  - Which college's Qdrant collection to search
 * @param {string} query      - The (already rephrased) standalone question
 * @param {number} topK       - Max chunks to retrieve (4 is a good default)
 * @returns {string|null}     - Formatted context string, or null if nothing relevant
 */
export async function retrieveContext(collegeId, query, topK = 4) {
  try {
    // Lazy imports — only load when RAG is actually needed
    const { VectorStoreIndex }           = await import('llamaindex')
    const { QdrantVectorStore }          = await import('@llamaindex/qdrant')
    const { GoogleGenerativeAIEmbedding } = await import('@llamaindex/google')

    const embedModel = new GoogleGenerativeAIEmbedding({
      model:  'text-embedding-004',
      apiKey: process.env.GOOGLE_AI_API_KEY,
    })

    const vectorStore = new QdrantVectorStore({
      url:            process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey:         process.env.QDRANT_API_KEY || undefined,
      collectionName: collectionName(collegeId),
    })

    // Load the existing index from Qdrant (doesn't re-ingest — just reads)
    const index     = await VectorStoreIndex.fromVectorStore(vectorStore, { embedModel })
    const retriever = index.asRetriever({ similarityTopK: topK })

    // Retrieve chunks
    const nodes = await retriever.retrieve(query)

    // Filter by similarity threshold — low-confidence chunks add noise
    const relevantNodes = nodes.filter(n => (n.score ?? 0) >= SIMILARITY_THRESHOLD)

    if (relevantNodes.length === 0) {
      console.log(`[RAG] No relevant context found (threshold ${SIMILARITY_THRESHOLD}) for: "${query.slice(0, 60)}..."`)
      return null
    }

    // Format chunks as numbered sources for the LLM
    const context = relevantNodes
      .map((n, i) => `[Source ${i + 1} — ${n.node.metadata?.title || 'Document'}]:\n${n.node.text}`)
      .join('\n\n')

    console.log(`[RAG] Retrieved ${relevantNodes.length} relevant chunks (scores: ${relevantNodes.map(n => n.score?.toFixed(2)).join(', ')})`)

    return context

  } catch (err) {
    // Gracefully handle Qdrant being unavailable or collection not existing yet.
    // These are expected states during development or before any documents are uploaded.
    if (
      err.message?.includes('Not found') ||
      err.message?.includes('ECONNREFUSED') ||
      err.message?.includes('does not exist') ||
      err.code === 'ECONNREFUSED'
    ) {
      console.warn(`[RAG] Qdrant unavailable or collection missing for ${collegeId} — falling back to LLM-only`)
      return null
    }

    // Unexpected error — rethrow so the worker's error handler catches it
    throw err
  }
}
