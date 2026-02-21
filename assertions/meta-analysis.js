/**
 * Custom assertions for meta-analysis output quality.
 *
 * Promptfoo calls this file as a custom assertion function.
 * It receives { output, context } and must return { pass, score, reason }.
 */

const VALID_STANCES = ['Far Left', 'Left-leaning', 'Centrist', 'Right-leaning', 'Far Right'];
const VALID_CONFIDENCE = ['high', 'medium', 'low'];

module.exports = (output, context) => {
  const results = [];
  let parsed;

  // --- Parse JSON ---
  try {
    parsed = typeof output === 'string' ? JSON.parse(output) : output;
  } catch {
    return { pass: false, score: 0, reason: 'Output is not valid JSON' };
  }

  // --- politicalStance: must be one of the 5 enum values ---
  if (!VALID_STANCES.includes(parsed.politicalStance)) {
    results.push(`politicalStance "${parsed.politicalStance}" is not a valid enum value`);
  }

  // --- paragraphSummary: 2-3 sentences (rough check via period count) ---
  if (!parsed.paragraphSummary || typeof parsed.paragraphSummary !== 'string') {
    results.push('paragraphSummary is missing or not a string');
  } else {
    const sentences = parsed.paragraphSummary.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length < 1) {
      results.push(`paragraphSummary has ${sentences.length} sentences (expected at least 1)`);
    }
    if (parsed.paragraphSummary.trim().length < 50) {
      results.push('paragraphSummary is too short (less than 50 chars)');
    }
  }

  // --- summary: 1-2 sentences ---
  if (!parsed.summary || typeof parsed.summary !== 'string') {
    results.push('summary is missing or not a string');
  } else if (parsed.summary.trim().length < 20) {
    results.push('summary is too short (less than 20 chars)');
  }

  // --- bulletPointsSummary: 3-7 non-empty items ---
  if (!Array.isArray(parsed.bulletPointsSummary)) {
    results.push('bulletPointsSummary is not an array');
  } else {
    const valid = parsed.bulletPointsSummary.filter(p => typeof p === 'string' && p.trim().length > 0);
    if (valid.length < 3) {
      results.push(`bulletPointsSummary has ${valid.length} items (expected at least 3)`);
    }
    if (valid.length > 7) {
      results.push(`bulletPointsSummary has ${valid.length} items (expected at most 7)`);
    }
  }

  // --- analysisConfidence: must be high/medium/low ---
  if (!VALID_CONFIDENCE.includes(parsed.analysisConfidence)) {
    results.push(`analysisConfidence "${parsed.analysisConfidence}" is not valid`);
  }

  // --- stanceExplanation: non-empty, at least ~2 sentences ---
  if (!parsed.stanceExplanation || typeof parsed.stanceExplanation !== 'string') {
    results.push('stanceExplanation is missing or not a string');
  } else if (parsed.stanceExplanation.trim().length < 30) {
    results.push('stanceExplanation is too short (less than 30 chars)');
  }

  // --- topQuotes: array of objects with text and context ---
  if (!Array.isArray(parsed.topQuotes)) {
    results.push('topQuotes is not an array');
  } else {
    for (let i = 0; i < parsed.topQuotes.length; i++) {
      const q = parsed.topQuotes[i];
      if (!q.text || typeof q.text !== 'string' || q.text.trim().length < 5) {
        results.push(`topQuotes[${i}].text is empty or too short`);
      }
      if (!q.context || typeof q.context !== 'string' || q.context.trim().length === 0) {
        results.push(`topQuotes[${i}].context is empty or missing`);
      }
    }
  }

  // --- topics: 3-5 non-empty strings ---
  if (!Array.isArray(parsed.topics)) {
    results.push('topics is not an array');
  } else {
    const valid = parsed.topics.filter(t => typeof t === 'string' && t.trim().length > 0);
    if (valid.length < 2) {
      results.push(`topics has ${valid.length} items (expected at least 2)`);
    }
    if (valid.length > 7) {
      results.push(`topics has ${valid.length} items (expected at most 7)`);
    }
  }

  // --- Score ---
  const totalChecks = 8;
  const failedChecks = results.length;
  const score = Math.max(0, 1 - failedChecks / totalChecks);

  return {
    pass: results.length === 0,
    score,
    reason: results.length === 0
      ? 'All meta-analysis quality checks passed'
      : `Failed checks: ${results.join('; ')}`,
  };
};
