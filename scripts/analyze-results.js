const data = require('../output/results.json');
const results = data.results.results;

console.log('=== BLINDSPOT LLM EVALUATION RESULTS ===');
console.log(`Total: ${results.length} test runs | Passed: ${data.results.stats.successes} | Failed: ${data.results.stats.failures}`);
console.log('');

// Group by provider
const byProvider = {};
for (const r of results) {
  const prov = r.provider?.label || r.provider?.id || 'unknown';
  if (!byProvider[prov]) byProvider[prov] = { pass: 0, fail: 0, failures: [], scores: [] };
  if (r.success) byProvider[prov].pass++;
  else {
    byProvider[prov].fail++;
    const failReasons = (r.gradingResult?.componentResults || [])
      .filter(c => !c.pass)
      .map(c => c.reason?.substring(0, 200));
    byProvider[prov].failures.push({ desc: r.description || '', reasons: failReasons });
  }
  if (r.gradingResult?.score !== undefined) {
    byProvider[prov].scores.push(r.gradingResult.score);
  }
}

console.log('=== PER-MODEL SCORECARD ===');
console.log('');
for (const [name, s] of Object.entries(byProvider)) {
  const total = s.pass + s.fail;
  const pct = ((s.pass / total) * 100).toFixed(0);
  const avgScore = s.scores.length > 0
    ? (s.scores.reduce((a, b) => a + b, 0) / s.scores.length).toFixed(2)
    : 'N/A';
  const icon = s.fail === 0 ? 'ALL PASS' : `${s.fail} FAILED`;
  console.log(`${name}:  ${s.pass}/${total} passed (${pct}%)  avg score: ${avgScore}  [${icon}]`);
  for (const f of s.failures) {
    console.log(`  FAILED on: ${f.desc.substring(0, 80)}`);
    for (const r of f.reasons) console.log(`    -> ${r}`);
  }
}

// Per-test breakdown
console.log('');
console.log('=== PER-TEST BREAKDOWN ===');
console.log('');
const byTest = {};
for (const r of results) {
  const desc = r.description || 'unnamed';
  if (!byTest[desc]) byTest[desc] = [];
  byTest[desc].push({
    provider: r.provider?.label || r.provider?.id,
    pass: r.success,
    score: r.gradingResult?.score,
  });
}

for (const [desc, runs] of Object.entries(byTest)) {
  console.log(`Test: ${desc}`);
  for (const run of runs) {
    const status = run.pass ? 'PASS' : 'FAIL';
    console.log(`  ${run.provider}: ${status} (score: ${run.score?.toFixed(2) || 'N/A'})`);
  }
  console.log('');
}

// Token usage
const tok = data.results.stats.tokenUsage;
console.log('=== TOKEN USAGE ===');
if (tok) {
  console.log(`Total: ${tok.total} | Prompt: ${tok.prompt} | Completion: ${tok.completion}`);
}
