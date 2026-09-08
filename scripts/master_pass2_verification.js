const { execSync } = require('child_process');

console.log('========================================================================');
console.log('FLIXWORLD MASTER PASS 2 - COMPLETE SYSTEMATIC AUDIT & RELEASE GATE');
console.log('========================================================================\n');

const audits = [
  { name: 'AGENT 1: Route & API Contract Audit', cmd: 'node scripts/audit_routes_and_apis.js' },
  { name: 'AGENT 2: 105-Title Content Identity Consistency Audit', cmd: 'node scripts/audit_100_content_identities.js' },
  { name: 'AGENT 3: Download System & Direct Media Probe Audit', cmd: 'node scripts/audit_download_qa.js' },
  { name: 'AGENT 4: Player Multi-Server & Streaming Endpoint Audit', cmd: 'node scripts/audit_player_qa.js' },
  { name: 'AGENT 6: Security, SSRF & Database Dump Defense Audit', cmd: 'node scripts/audit_security_qa.js' },
  { name: 'AGENT 7: UI, Responsive Breakpoints & Button Emoji Audit', cmd: 'node scripts/audit_ui_responsive_qa.js' },
  { name: 'AGENT 8: SEO, Meta Tags, Assets & PWA Manifest Audit', cmd: 'node scripts/audit_seo_assets_pwa.js' },
  { name: 'AGENT 9: Performance, Latency & Caching Audit', cmd: 'node scripts/audit_performance_qa.js' },
  { name: 'AGENT 10: Browser CDP Verification Flow Audit', cmd: 'node scripts/verify_all_requirements.js' }
];

let totalPassed = 0;
let totalFailed = 0;
const results = [];

for (const a of audits) {
  console.log(`\n▶️ RUNNING ${a.name}...`);
  try {
    const output = execSync(a.cmd, { stdio: 'pipe', encoding: 'utf8' });
    console.log(output.trim());
    console.log(`✅ ${a.name}: COMPLETED SUCCESSFULLY`);
    totalPassed++;
    results.push({ name: a.name, status: 'PASS' });
  } catch(err) {
    console.error(`❌ ${a.name}: FAILED`);
    if (err.stdout) console.log(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    totalFailed++;
    results.push({ name: a.name, status: 'FAIL', error: err.message });
  }
}

console.log('\n========================================================================');
console.log('FLIXWORLD MASTER PASS 2 CONSOLIDATED RESULTS');
console.log('========================================================================');
console.log(`Total Workstreams Run: ${audits.length}`);
console.log(`Workstreams Passed:    ${totalPassed}`);
console.log(`Workstreams Failed:    ${totalFailed}`);
console.log('------------------------------------------------------------------------');
results.forEach(r => console.log(`${r.status === 'PASS' ? '✅' : '❌'} ${r.name}: ${r.status}`));
console.log('========================================================================\n');

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
