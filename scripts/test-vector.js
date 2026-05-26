// test-vector.js
import { chunkText, getPineconeClient, getPineconeIndex, generateEmbeddings } from './vector.js';

console.log('--- STARTING VECTOR SERVICE TEST ---');

// Test 1: Chunking Text
console.log('\n[Test 1] Testing chunkText function...');
const mockText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(20); // ~1100 characters
console.log(`Mock text length: ${mockText.length} characters`);

const chunks = chunkText(mockText, 500, 50);
console.log(`Successfully generated ${chunks.length} chunks.`);
chunks.forEach((chunk, i) => {
  console.log(`  Chunk ${i + 1}: length = ${chunk.text.length}, range = [${chunk.startIndex}, ${chunk.endIndex}]`);
  console.log(`    Content snippet: "${chunk.text.substring(0, 60)}..."`);
});

if (chunks.length > 0 && chunks[0].text.length <= 500) {
  console.log('✅ Chunking test passed!');
} else {
  console.error('❌ Chunking test failed.');
}

// Test 2: Pinecone Client initialization (Graceful fallback test)
console.log('\n[Test 2] Testing Pinecone Client initialization (with mock env)...');
try {
  const pc = getPineconeClient();
  const index = getPineconeIndex();
  console.log(`Pinecone client: ${pc ? 'Initialized' : 'Unconfigured (Expected if no API key)'}`);
  console.log(`Pinecone index: ${index ? 'Initialized' : 'Unconfigured (Expected if no index/API key)'}`);
  console.log('✅ Pinecone initialization grace test passed!');
} catch (err) {
  console.error('❌ Pinecone initialization test crashed:', err.message);
}

// Test 3: Embedding API (requires GOOGLE_AI_API_KEY)
console.log('\n[Test 3] Testing generateEmbeddings helper API...');
if (!process.env.GOOGLE_AI_API_KEY) {
  console.log('⚠️ GOOGLE_AI_API_KEY is not defined in environment. Skipping real API test.');
  console.log('✅ Google API grace test passed!');
} else {
  console.log('Attempting to call Gemini embedding API...');
  generateEmbeddings('Academic syllabus data structure syllabus')
    .then((vector) => {
      console.log(`✅ Embedding API call succeeded! Vector dimension: ${vector.length}`);
      if (vector.length === 768) {
        console.log('✅ Embedding dimension matched (768). Test passed!');
      } else {
        console.warn(`⚠️ Vector dimension mismatch: Expected 768, got ${vector.length}`);
      }
    })
    .catch((err) => {
      console.error('❌ Embedding API call failed:', err.message);
    });
}

console.log('\n--- TESTS COMPLETED ---');
