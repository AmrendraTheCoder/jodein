// src/services/vector.js
/**
 * @fileoverview Core curriculum vector database service for Jodein.
 * Handles document chunking, embedding generation using Gemini's text-embedding-004 model,
 * and isolated namespace upserts/queries in Pinecone divided by collegeId.
 * 
 * Flow:
 * 1. Syllabus/PYQ Document -> Text Extraction (External)
 * 2. Splitting -> chunkText (~500 chars, 50 chars overlap)
 * 3. Embedding -> generateEmbeddings (Gemini text-embedding-004, 768 dimensions)
 * 4. Upsert/Query -> Pinecone isolated namespaces per collegeId
 */

import crypto from 'crypto';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';

// Load environment variables
config();

let pineconeClient = null;
let pineconeIndex = null;
let genAI = null;

/**
 * Initializes and retrieves the Pinecone client instance.
 * Gracefully handles missing API key env variable.
 * 
 * @returns {Pinecone|null} Active Pinecone client, or null if unconfigured
 */
export function getPineconeClient() {
  if (pineconeClient) return pineconeClient;

  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    console.warn('[Vector] PINECONE_API_KEY is not defined. Vector DB features are disabled.');
    return null;
  }

  try {
    pineconeClient = new Pinecone({ apiKey });
    return pineconeClient;
  } catch (err) {
    console.error('[Vector] Failed to initialize Pinecone client:', err.message);
    return null;
  }
}

/**
 * Retrieves the Pinecone Index instance for vector queries and upserts.
 * Gracefully handles missing index configuration or initialization errors.
 * 
 * @returns {import('@pinecone-database/pinecone').Index|null} Active Pinecone index, or null if unconfigured/unreachable
 */
export function getPineconeIndex() {
  if (pineconeIndex) return pineconeIndex;

  const pc = getPineconeClient();
  if (!pc) return null;

  const indexName = process.env.PINECONE_INDEX || 'jodein';
  try {
    pineconeIndex = pc.index(indexName);
    return pineconeIndex;
  } catch (err) {
    console.error(`[Vector] Failed to load Pinecone index "${indexName}":`, err.message);
    return null;
  }
}

/**
 * Initializes and retrieves the Google Generative AI client instance.
 * Gracefully handles missing API key env variable.
 * 
 * @returns {GoogleGenerativeAI|null} Active GoogleGenerativeAI instance, or null if unconfigured
 */
function getGenAI() {
  if (genAI) return genAI;

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.warn('[Vector] GOOGLE_AI_API_KEY is not defined. Embedding generation is disabled.');
    return null;
  }

  try {
    genAI = new GoogleGenerativeAI(apiKey);
    return genAI;
  } catch (err) {
    console.error('[Vector] Failed to initialize Google Generative AI:', err.message);
    return null;
  }
}

/**
 * Split text documents (syllabi, PYQs, handbooks) into overlapping chunks.
 * Standardizes on ~500 character chunks with a 50-character overlap.
 * 
 * @param {string} text - Raw text content of the document
 * @param {number} [chunkSize=500] - Approximate size of each chunk in characters
 * @param {number} [overlap=50] - Character overlap between contiguous chunks
 * @returns {Array<{text: string, startIndex: number, endIndex: number}>} Array of text chunks with position indices
 */
export function chunkText(text, chunkSize = 500, overlap = 50) {
  if (!text || typeof text !== 'string') return [];

  const chunks = [];
  const textLength = text.length;
  let start = 0;

  // Prevent infinite loops if configuration is invalid
  const step = chunkSize - overlap;
  if (step <= 0) {
    console.warn('[Vector] Chunk size must be greater than overlap. Falling back to non-overlapping chunks.');
    return [{ text, startIndex: 0, endIndex: textLength }];
  }

  while (start < textLength) {
    let end = start + chunkSize;
    if (end > textLength) {
      end = textLength;
    }

    const chunk = text.substring(start, end);
    chunks.push({
      text: chunk,
      startIndex: start,
      endIndex: end,
    });

    if (end === textLength) {
      break;
    }

    start += step;
  }

  return chunks;
}

/**
 * Calls Google's Gemini text-embedding-004 service to generate 768-dimension vectors.
 * Handles both single string inputs and batch inputs.
 * 
 * @param {string|string[]} textOrTexts - Text chunk(s) to generate embeddings for
 * @returns {Promise<number[]|number[][]>} The generated 768-dimension vector or an array of vectors
 */
export async function generateEmbeddings(textOrTexts) {
  const ai = getGenAI();
  if (!ai) {
    throw new Error('Google Generative AI is not initialized. Check GOOGLE_AI_API_KEY.');
  }

  try {
    const model = ai.getGenerativeModel({ model: 'text-embedding-004' });

    if (Array.isArray(textOrTexts)) {
      if (textOrTexts.length === 0) return [];
      
      // Attempt batch embedding API for efficiency
      try {
        const response = await model.batchEmbedContents({
          requests: textOrTexts.map((text) => ({
            model: 'models/text-embedding-004',
            content: { parts: [{ text }] },
          })),
        });

        if (response && response.embeddings) {
          return response.embeddings.map((e) => e.values);
        }
      } catch (batchErr) {
        console.warn('[Vector] Batch embedding failed, falling back to sequential calls:', batchErr.message);
      }

      // Fallback: Process sequentially in parallel using Promise.all
      const promises = textOrTexts.map(async (text) => {
        const result = await model.embedContent(text);
        return result.embedding.values;
      });

      return Promise.all(promises);
    } else {
      const result = await model.embedContent(textOrTexts);
      if (!result || !result.embedding || !result.embedding.values) {
        throw new Error('Invalid response from Gemini embedding API.');
      }
      return result.embedding.values;
    }
  } catch (err) {
    console.error('[Vector] Embedding generation failed:', err.message);
    throw err;
  }
}

/**
 * Chunks a syllabus or PYQ document, generates 768-dimension embeddings via Gemini,
 * and upserts them to Pinecone under a college-specific isolated namespace.
 * 
 * @param {string} collegeId - The unique identifier of the college (used as namespace)
 * @param {string} text - Raw document text
 * @param {string} documentTitle - Title of the syllabus or PYQ document (e.g. "B.Tech CSE Syllabus 2024")
 * @param {string} sourceFilename - Base filename of the document (e.g. "syllabus.pdf")
 * @returns {Promise<{success: boolean, chunksCount: number, error?: string}>} Object representing the success state
 */
export async function upsertDocument(collegeId, text, documentTitle, sourceFilename) {
  try {
    if (!collegeId) throw new Error('collegeId is required for namespace isolation.');
    if (!text || text.trim().length === 0) throw new Error('Document text is empty.');

    const index = getPineconeIndex();
    if (!index) {
      console.warn('[Vector] Pinecone index is not initialized. Skipping document upsert.');
      return { success: false, chunksCount: 0, error: 'Pinecone index not initialized' };
    }

    // 1. Split document into overlapping chunks
    const chunks = chunkText(text, 500, 50);
    if (chunks.length === 0) {
      return { success: true, chunksCount: 0 };
    }

    console.log(`[Vector] Ingesting "${documentTitle}" (${sourceFilename}): generated ${chunks.length} chunks.`);

    // 2. Generate embeddings for chunks
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await generateEmbeddings(chunkTexts);

    // 3. Construct the upsert payloads
    const records = chunks.map((chunk, idx) => {
      // Create a deterministic unique ID based on parameters to avoid duplicate chunks on re-ingestion
      const idSeed = `${collegeId}-${documentTitle}-${sourceFilename}-${idx}`;
      const chunkId = crypto.createHash('md5').update(idSeed).digest('hex');

      return {
        id: chunkId,
        values: embeddings[idx],
        metadata: {
          text: chunk.text,
          collegeId,
          title: documentTitle,
          source: sourceFilename,
          startIndex: chunk.startIndex,
          endIndex: chunk.endIndex,
          ingestedAt: new Date().toISOString(),
        },
      };
    });

    // 4. Batch upsert to Pinecone index namespace
    const batchSize = 100;
    const ns = index.namespace(collegeId);

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await ns.upsert(batch);
    }

    console.log(`[Vector] Successfully upserted ${records.length} vectors to Pinecone namespace "${collegeId}"`);
    return { success: true, chunksCount: records.length };
  } catch (err) {
    console.error('[Vector] Error in upsertDocument:', err.message);
    return { success: false, chunksCount: 0, error: err.message };
  }
}

/**
 * Queries Pinecone within a college's isolated namespace, performs cosine similarity searches,
 * and retrieves matched context formatted for LLM usage.
 * 
 * @param {string} collegeId - The unique identifier of the college (namespace)
 * @param {string} queryText - The student's academic or syllabus question
 * @param {number} [topK=4] - Number of context chunks to retrieve
 * @param {number} [minScore=0.70] - Minimum cosine similarity score threshold (0.0 to 1.0)
 * @returns {Promise<string|null>} Formatted context string with sources, or null if no relevant context found
 */
export async function queryNamespace(collegeId, queryText, topK = 4, minScore = 0.70) {
  try {
    if (!collegeId) return null;
    if (!queryText || queryText.trim().length === 0) return null;

    const index = getPineconeIndex();
    if (!index) {
      console.warn('[Vector] Pinecone index is not initialized. Skipping namespace query.');
      return null;
    }

    // 1. Generate query embedding
    const queryEmbedding = await generateEmbeddings(queryText);

    // 2. Query the Pinecone isolated namespace
    const ns = index.namespace(collegeId);
    const queryResponse = await ns.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true,
    });

    if (!queryResponse || !queryResponse.matches || queryResponse.matches.length === 0) {
      console.log(`[Vector] No context matches found for query: "${queryText}" in namespace "${collegeId}"`);
      return null;
    }

    // 3. Filter retrieved documents by minimum score threshold
    const relevantMatches = queryResponse.matches.filter((match) => {
      if (match.score === undefined) return true; // Keep if no score returned
      return match.score >= minScore;
    });

    if (relevantMatches.length === 0) {
      console.log(`[Vector] Match score was below the minimum threshold (${minScore}) for query: "${queryText}"`);
      return null;
    }

    // 4. Synthesize context content block with source citations
    const context = relevantMatches
      .map((match, idx) => {
        const meta = match.metadata || {};
        const title = meta.title || 'Syllabus/PYQ Document';
        const source = meta.source || 'Reference Source';
        const scorePct = match.score !== undefined ? ` (Similarity: ${(match.score * 100).toFixed(1)}%)` : '';
        return `[Source ${idx + 1}: ${title} - ${source}]${scorePct}\n${meta.text}`;
      })
      .join('\n\n');

    console.log(`[Vector] Retrieved ${relevantMatches.length} relevant context chunks from namespace "${collegeId}"`);
    return context;
  } catch (err) {
    console.error(`[Vector] Graceful failure during namespace query:`, err.message);
    // Fall back to general LLM capability by returning null
    return null;
  }
}
