/**
 * Extract test data from the Blindspot Neon database.
 *
 * Pulls completed episodes with good Gemma3:12b analysis results,
 * extracts transcript chunks and corresponding expected outputs.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/extract-test-data.ts
 *
 * Prerequisites:
 *   npm install @neondatabase/serverless ws
 */

import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Neon requires WebSocket polyfill in Node
neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required');
  console.error('Usage: DATABASE_URL=postgresql://... npx tsx scripts/extract-test-data.ts');
  process.exit(1);
}

const TRANSCRIPT_DIR = join(__dirname, '..', 'test-cases', 'transcripts');
const EXPECTED_DIR = join(__dirname, '..', 'test-cases', 'expected');

// Target ~2000 tokens per chunk (roughly 8000 chars)
const CHUNK_SIZE_CHARS = 8000;

interface Episode {
  id: number;
  title: string;
  podcast_name: string;
  transcript_text: string;
  transcript_timestamps: string | null;
  political_stance: string;
  summary: string;
  paragraph_summary: string;
  bullet_points_summary: string;
  political_stance_explanation: string;
  analysis_confidence: string;
  topics: string;
}

/**
 * Number sentences in a transcript segment like the Blindspot chunker does.
 * Each sentence gets a [N] prefix for the LLM to reference.
 */
function numberSentences(text: string): string {
  // Split on sentence boundaries
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  return sentences.map((s, i) => `[${i}] ${s}`).join('\n');
}

/**
 * Slugify a string for use as a filename
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    console.log('Connecting to database...');

    // Find completed episodes with analysis results, diverse political stances
    const { rows: episodes } = await pool.query<Episode>(`
      SELECT
        e.id,
        e.title,
        p.name as podcast_name,
        e.transcript_text,
        e.transcript_timestamps,
        e.political_stance,
        e.summary,
        e.paragraph_summary,
        e.bullet_points_summary,
        e.political_stance_explanation,
        e.analysis_confidence,
        e.topics
      FROM episodes e
      JOIN podcasts p ON e.podcast_id = p.id
      WHERE e.transcript_text IS NOT NULL
        AND e.political_stance IS NOT NULL
        AND e.summary IS NOT NULL
        AND e.paragraph_summary IS NOT NULL
        AND e.completed_at IS NOT NULL
        AND length(e.transcript_text) > 5000
      ORDER BY e.completed_at DESC
      LIMIT 20
    `);

    console.log(`Found ${episodes.length} completed episodes with analysis`);

    if (episodes.length === 0) {
      console.error('No suitable episodes found');
      process.exit(1);
    }

    // Select up to 5 episodes with diverse political stances
    const selected: Episode[] = [];
    const stancesSeen = new Set<string>();

    for (const ep of episodes) {
      if (selected.length >= 5) break;
      // Prefer diversity, but take what we can get
      if (!stancesSeen.has(ep.political_stance) || selected.length < 3) {
        selected.push(ep);
        stancesSeen.add(ep.political_stance);
      }
    }

    console.log(`Selected ${selected.length} episodes for test data:`);

    mkdirSync(TRANSCRIPT_DIR, { recursive: true });
    mkdirSync(EXPECTED_DIR, { recursive: true });

    for (const ep of selected) {
      const slug = slugify(ep.podcast_name) + '-' + slugify(ep.title);
      console.log(`\n--- ${ep.title} (${ep.political_stance}) ---`);

      // Extract first chunk of transcript (~2000 tokens)
      const transcript = ep.transcript_text;
      const chunk = transcript.slice(0, CHUNK_SIZE_CHARS);

      // Number the sentences for the chunk analysis prompt
      const numberedChunk = numberSentences(chunk);

      // Save transcript chunk
      const transcriptFile = join(TRANSCRIPT_DIR, `${slug}.txt`);
      writeFileSync(transcriptFile, numberedChunk);
      console.log(`  Transcript: ${transcriptFile}`);

      // Build expected meta-analysis output from DB fields
      const expectedMeta = {
        paragraphSummary: ep.paragraph_summary,
        summary: ep.summary,
        bulletPointsSummary: ep.bullet_points_summary
          ? JSON.parse(ep.bullet_points_summary)
          : [],
        analysisConfidence: ep.analysis_confidence || 'medium',
        politicalStance: ep.political_stance,
        stanceExplanation: ep.political_stance_explanation || '',
        topQuotes: [], // Not stored separately in the DB at episode level
        topics: ep.topics ? JSON.parse(ep.topics) : [],
      };

      const expectedMetaFile = join(EXPECTED_DIR, `${slug}-meta.json`);
      writeFileSync(expectedMetaFile, JSON.stringify(expectedMeta, null, 2));
      console.log(`  Expected meta: ${expectedMetaFile}`);
    }

    console.log('\nDone! Test data extracted successfully.');
    console.log(`\nTranscript chunks: ${TRANSCRIPT_DIR}`);
    console.log(`Expected outputs:  ${EXPECTED_DIR}`);

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
