/**
 * Dynamic Promptfoo config that fetches the latest episode from the database.
 *
 * Replaces the static promptfooconfig.yaml — Promptfoo auto-detects this file.
 */

require('dotenv').config();

const { fetchLatestEpisode } = require('./scripts/fetch-latest-episode');

const chunkConfig = {
  temperature: 0.2,
  num_predict: 8192,
  top_p: 0.9,
  top_k: 40,
  keep_alive: 0,
  passthrough: {
    format: {
      type: 'object',
      properties: {
        keyPoints: { type: 'array', items: { type: 'string' } },
        quotes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              startIndex: { type: 'integer' },
              endIndex: { type: 'integer' },
              context: { type: 'string' },
              significance: { type: 'string', enum: ['high', 'medium', 'low'] },
            },
            required: ['startIndex', 'endIndex', 'context', 'significance'],
          },
        },
        stanceSignals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              position: { type: 'string' },
              strength: { type: 'string', enum: ['strong', 'moderate', 'weak'] },
            },
            required: ['topic', 'position', 'strength'],
          },
        },
        topics: { type: 'array', items: { type: 'string' } },
        tone: { type: 'string' },
      },
      required: ['keyPoints', 'quotes', 'stanceSignals', 'topics', 'tone'],
    },
  },
};

const semanticRubric = `You are evaluating an LLM's political analysis of a podcast transcript.
The LLM was given a transcript and asked to extract keyPoints, quotes,
stanceSignals, topics, and tone. Verify the analysis is semantically
accurate by cross-referencing against the original transcript below.

Check: (1) Factual accuracy of keyPoints — flag any inversions, misattributions,
or fabricated claims. (2) Quote validity — do startIndex/endIndex ranges reference
content supporting the stated context? (3) Stance signal correctness — does each
position match what the transcript actually says? Watch for inverted positions
(e.g. "supports public hearings" when the speaker prefers depositions) and
misattributed stances. (4) Topic relevance — topics should reflect the transcript,
not hallucinated subjects.

ORIGINAL TRANSCRIPT:
{{transcript}}

Return a score between 0 and 1 using these deductions from a starting score of 1.0:
- Major error (fabricated claim, inverted position): -0.3
- Moderate error (misattribution, wrong name): -0.2
- Minor error (omission in parenthetical, imprecise phrasing): -0.1
List each error found with its severity before computing the final score.`;

module.exports = (async () => {
  let episode;
  try {
    episode = await fetchLatestEpisode(process.env.DATABASE_URL);
  } catch (err) {
    console.error('Failed to fetch latest episode from database:', err.message);
    process.exit(1);
  }

  console.log(`Loaded test case: ${episode.description}`);

  // Dynamic context window: rough chars-to-tokens conversion plus headroom
  const numCtx = Math.max(8192, Math.ceil(episode.transcriptCharCount / 3.5) + 4096);
  const providerConfig = { ...chunkConfig, num_ctx: numCtx };

  return {
    description: 'Blindspot LLM Political Analysis Evaluation',

    providers: [
      { id: 'ollama:chat:gemma3:12b', label: 'Gemma3 12B (baseline)', config: providerConfig },
      { id: 'ollama:chat:phi4-mini', label: 'Phi-4 Mini 3.8B', config: providerConfig },
      { id: 'ollama:chat:llama3.2:3b', label: 'Llama 3.2 3B', config: providerConfig },
      { id: 'ollama:chat:granite3.3:8b', label: 'Granite 3.3 8B', config: providerConfig },
    ],

    prompts: ['file://prompts/chunk-analysis.json'],

    tests: [
      {
        description: episode.description,
        vars: {
          transcript: episode.transcript,
        },
        assert: [
          { type: 'is-json' },
          { type: 'javascript', value: 'file://assertions/chunk-analysis.js' },
          { type: 'llm-rubric', value: semanticRubric, threshold: 0.6 },
          { type: 'factuality', value: episode.factualityFacts },
        ],
      },
    ],

    defaultTest: {
      options: {
        timeout: 900000,
        provider: 'anthropic:messages:claude-sonnet-4-6',
      },
    },
  };
})();
