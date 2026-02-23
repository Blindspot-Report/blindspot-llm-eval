const data = require('../output/results.json');
const results = data.results.results;

const gemmaFails = results.filter(r => {
  const label = r.provider?.label || '';
  return label.includes('Gemma3') && r.success === false;
});

console.log(`Found ${gemmaFails.length} Gemma3 failures\n`);

for (const f of gemmaFails) {
  console.log('--- GEMMA3 FAILURE ---');
  const transcript = f.vars?.transcript || '';
  console.log('Transcript preview:', transcript.substring(0, 80) + '...');
  console.log('');

  const output = String(f.response?.output || '');
  console.log('Raw output (first 600 chars):');
  console.log(output.substring(0, 600));
  console.log('');

  console.log('Assertion results:');
  for (const c of (f.gradingResult?.componentResults || [])) {
    const status = c.pass ? 'PASS' : 'FAIL';
    console.log(`  ${status} [${c.assertion?.type}]: ${(c.reason || '').substring(0, 200)}`);
  }
  console.log('');
}
