#!/usr/bin/env node
/**
 * Replays every captured real website in docs/corpus/ through the audit engine, offline.
 *
 * Fixtures prove the engine reports what we told it to report. This proves what it says about real sites —
 * and, more to the point, it makes a false positive VISIBLE. A check that fires on three quarters of the
 * corpus is either describing a genuine epidemic or is broken, and the frequency table is where you can tell
 * the difference at a glance. Every false statement the audit found had been shipping for days because
 * nothing ever ran the engine over a page we had not written ourselves.
 *
 * Build the corpus with scripts/audit-capture.mjs on a machine that has internet, then commit it: from that
 * point this runs in CI, on every change, with no network.
 *
 *   node scripts/run-tests.mjs corpus          # as part of the suite
 *   node scripts/audit-corpus.mjs --verbose    # every finding, site by site
 *   node scripts/audit-corpus.mjs --id lang.frenchMissing   # who trips one check, and why
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyze, FINDING_IDS, POSITIVE_FINDING_IDS } from '../packages/lander-kit/lib/audit.ts';
import { versions } from '../sites/createawebsite-ca/src/data/versions.ts';

const root = new URL('..', import.meta.url).pathname;
const dir = join(root, 'docs', 'corpus');
const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const only = args[args.indexOf('--id') + 1];

if (!existsSync(dir) || readdirSync(dir).filter((f) => f.endsWith('.json')).length === 0) {
  console.log('no corpus yet — see scripts/audit-capture.mjs. Skipping.');
  process.exit(0);
}

const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const reports = files.map((f) => {
  const snap = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  return { file: f, host: f.replace(/\.json$/, ''), report: analyze(snap, versions) };
});

/* ---- what fires, and how often ---- */
const frequency = new Map();
for (const { host, report } of reports) {
  for (const f of report.findings) {
    if (!frequency.has(f.id)) frequency.set(f.id, { severity: f.severity, hosts: [] });
    frequency.get(f.id).hosts.push(host);
  }
}

const n = reports.length;
console.log(`\n${n} real site(s) replayed through the engine.\n`);

if (only) {
  const hit = frequency.get(only);
  if (!hit) { console.log(`${only} fires on none of them.`); process.exit(0); }
  console.log(`${only} (${hit.severity}) fires on ${hit.hosts.length}/${n}:\n`);
  for (const host of hit.hosts) {
    const f = reports.find((r) => r.host === host).report.findings.find((x) => x.id === only);
    console.log(`  ${host}${f.evidence ? `\n      evidence: ${f.evidence}` : ''}${f.params ? `\n      params:   ${JSON.stringify(f.params)}` : ''}`);
  }
  process.exit(0);
}

console.log('score  urgent  fix  small  good  platform        recommendation   site');
for (const { host, report: r } of reports) {
  console.log(
    `${String(r.score).padStart(5)}  ${String(r.counts.critical).padStart(6)}  ${String(r.counts.warning).padStart(3)}  ${String(r.counts.info).padStart(5)}  ${String(r.counts.good).padStart(4)}  ` +
    `${(r.platform + (r.platformVersion ? ` ${r.platformVersion}` : '')).padEnd(15)} ${r.recommendation.id.padEnd(16)} ${host}`,
  );
}

console.log('\nhow often each check fires across the corpus:\n');
const rows = [...frequency.entries()].sort((a, b) => b[1].hosts.length - a[1].hosts.length);
for (const [id, { severity, hosts }] of rows) {
  const share = hosts.length / n;
  // A critical that fires on most real sites is a claim about the web; more often it is a bug. Either way
  // it is the thing to look at first, so it is called out rather than left in a column to be scanned past.
  const flag = severity === 'critical' && share > 0.5 ? '  <-- on most sites; verify this is real'
    : severity === 'warning' && share > 0.8 ? '  <-- on nearly every site; verify this is real'
    : '';
  console.log(`  ${String(hosts.length).padStart(3)}/${n}  ${severity.padEnd(8)} ${id.padEnd(30)}${flag}`);
}

const never = FINDING_IDS.filter((id) => !frequency.has(id));
if (never.length) {
  console.log(`\n${never.length} check(s) fired on nothing in this corpus — untested against reality, not proven harmless:`);
  console.log(`  ${never.join(', ')}`);
}

if (verbose) {
  for (const { host, report: r } of reports) {
    console.log(`\n=== ${host} — ${r.score}/100, ${r.recommendation.id} ===`);
    for (const f of r.findings) {
      if (POSITIVE_FINDING_IDS.includes(f.id)) continue;
      console.log(`  ${f.severity.padEnd(8)} ${f.area.padEnd(12)} ${f.id}${f.evidence ? `  — ${f.evidence.slice(0, 70)}` : ''}`);
    }
  }
}

console.log('\nNothing here passes or fails on its own: read it. The engine cannot tell a real epidemic from a bug.');
