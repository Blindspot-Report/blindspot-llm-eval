/**
 * Custom assertions for chunk analysis output quality.
 *
 * Promptfoo calls this file as a custom assertion function.
 * It receives { output, context } and must return { pass, score, reason }.
 */

module.exports = (output, context) => {
  const results = [];
  let parsed;

  // --- Parse JSON ---
  try {
    parsed = typeof output === 'string' ? JSON.parse(output) : output;
  } catch {
    return { pass: false, score: 0, reason: 'Output is not valid JSON' };
  }

  // --- keyPoints: 2-4 non-empty strings ---
  if (!Array.isArray(parsed.keyPoints)) {
    results.push('keyPoints is not an array');
  } else {
    const valid = parsed.keyPoints.filter(p => typeof p === 'string' && p.trim().length > 0);
    if (valid.length < 1) {
      results.push(`keyPoints has ${valid.length} non-empty items (expected at least 1)`);
    }
    if (valid.length > 8) {
      results.push(`keyPoints has ${valid.length} items (expected at most 8)`);
    }
  }

  // --- quotes: 0-3 items with valid fields ---
  if (!Array.isArray(parsed.quotes)) {
    results.push('quotes is not an array');
  } else {
    if (parsed.quotes.length > 5) {
      results.push(`quotes has ${parsed.quotes.length} items (expected at most 5)`);
    }
    for (let i = 0; i < parsed.quotes.length; i++) {
      const q = parsed.quotes[i];
      if (typeof q.startIndex !== 'number' || !Number.isInteger(q.startIndex)) {
        results.push(`quotes[${i}].startIndex is not an integer`);
      }
      if (typeof q.endIndex !== 'number' || !Number.isInteger(q.endIndex)) {
        results.push(`quotes[${i}].endIndex is not an integer`);
      }
      if (typeof q.startIndex === 'number' && typeof q.endIndex === 'number' && q.startIndex > q.endIndex) {
        results.push(`quotes[${i}].startIndex (${q.startIndex}) > endIndex (${q.endIndex})`);
      }
      if (!q.context || typeof q.context !== 'string' || q.context.trim().length === 0) {
        results.push(`quotes[${i}].context is empty or missing`);
      }
      if (!['high', 'medium', 'low'].includes(q.significance)) {
        results.push(`quotes[${i}].significance is invalid: ${q.significance}`);
      }
    }
  }

  // --- stanceSignals: each has non-empty topic and position ---
  if (!Array.isArray(parsed.stanceSignals)) {
    results.push('stanceSignals is not an array');
  } else {
    for (let i = 0; i < parsed.stanceSignals.length; i++) {
      const s = parsed.stanceSignals[i];
      if (!s.topic || typeof s.topic !== 'string' || s.topic.trim().length === 0) {
        results.push(`stanceSignals[${i}].topic is empty or missing`);
      }
      if (!s.position || typeof s.position !== 'string' || s.position.trim().length === 0) {
        results.push(`stanceSignals[${i}].position is empty or missing`);
      }
      if (!['strong', 'moderate', 'weak'].includes(s.strength)) {
        results.push(`stanceSignals[${i}].strength is invalid: ${s.strength}`);
      }
    }
  }

  // --- topics: non-empty array of strings ---
  if (!Array.isArray(parsed.topics)) {
    results.push('topics is not an array');
  } else if (parsed.topics.length === 0) {
    results.push('topics array is empty');
  } else {
    const invalid = parsed.topics.filter(t => typeof t !== 'string' || t.trim().length === 0);
    if (invalid.length > 0) {
      results.push(`topics has ${invalid.length} empty/non-string items`);
    }
  }

  // --- tone: non-empty string ---
  if (!parsed.tone || typeof parsed.tone !== 'string' || parsed.tone.trim().length === 0) {
    results.push('tone is empty or missing');
  }

  // --- Score ---
  const totalChecks = 5; // keyPoints, quotes, stanceSignals, topics, tone
  const failedChecks = results.length;
  const score = Math.max(0, 1 - failedChecks / totalChecks);

  return {
    pass: results.length === 0,
    score,
    reason: results.length === 0
      ? 'All chunk analysis quality checks passed'
      : `Failed checks: ${results.join('; ')}`,
  };
};
