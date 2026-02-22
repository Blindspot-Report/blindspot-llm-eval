/**
 * Fetch the latest completed episode from the Neon PostgreSQL database.
 *
 * Returns { transcript, description, factualityFacts } for use as a
 * dynamic Promptfoo test case.
 */

const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

// Neon requires WebSocket polyfill in Node
neonConfig.webSocketConstructor = ws;

/**
 * Number sentences like the Blindspot chunker does.
 */
function numberSentences(text) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  return sentences.map((s, i) => `[${i}] ${s}`).join('\n');
}

/**
 * Derive factuality facts from the episode's production analysis fields.
 */
function buildFactualityFacts(episode) {
  const facts = [];

  // Bullet points are the most concrete factual claims
  if (episode.bullet_points_summary) {
    try {
      const bullets = JSON.parse(episode.bullet_points_summary);
      for (const bullet of bullets) {
        if (typeof bullet === 'string' && bullet.trim().length > 0) {
          facts.push(bullet.trim());
        }
      }
    } catch {
      // If not JSON, treat as newline-separated text
      const lines = episode.bullet_points_summary.split('\n').filter(l => l.trim());
      facts.push(...lines.map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean));
    }
  }

  // Add political stance as a fact
  if (episode.political_stance) {
    facts.push(
      `The overall political stance of this episode is ${episode.political_stance}.`
    );
  }

  return facts.join('\n');
}

/**
 * Fetch the latest completed episode from the database.
 *
 * @param {string} databaseUrl - PostgreSQL connection string
 * @returns {Promise<{ transcript: string, description: string, factualityFacts: string }>}
 */
async function fetchLatestEpisode(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const { rows } = await pool.query(`
      SELECT
        e.id,
        e.title,
        p.name as podcast_name,
        e.transcript_text,
        e.political_stance,
        e.bullet_points_summary,
        e.completed_at
      FROM episodes e
      JOIN podcasts p ON e.podcast_id = p.id
      WHERE e.transcript_text IS NOT NULL
        AND e.political_stance IS NOT NULL
        AND e.summary IS NOT NULL
        AND e.completed_at IS NOT NULL
        AND length(e.transcript_text) > 5000
      ORDER BY e.completed_at DESC
      LIMIT 1
    `);

    if (rows.length === 0) {
      throw new Error('No completed episodes with analysis found in database');
    }

    const episode = rows[0];
    const transcript = numberSentences(episode.transcript_text);
    const transcriptCharCount = episode.transcript_text.length;
    const description = `${episode.podcast_name} — ${episode.title}`;
    const factualityFacts = buildFactualityFacts(episode);

    return { transcript, description, factualityFacts, transcriptCharCount };
  } finally {
    await pool.end();
  }
}

module.exports = { fetchLatestEpisode, numberSentences, buildFactualityFacts };
