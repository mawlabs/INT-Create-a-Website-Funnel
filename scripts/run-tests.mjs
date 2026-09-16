#!/usr/bin/env node
/**
 * Runs the engine tests. They import TypeScript from the kit, so each is bundled with the esbuild binary that
 * ships with the workspace and then run — no extra dependency, and no loader flags to remember.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const only = process.argv[2];
const suites = [
  { name: 'quote', entry: 'scripts/quote-test.mjs' },
  { name: 'audit', entry: 'scripts/audit-test.mjs' },
  // Runs the checker against this site's own built pages. Needs a build, so it is skipped without one.
  { name: 'self', entry: 'scripts/audit-self.mjs', needs: 'sites/createawebsite-ca/dist' },
  // Replays real websites captured by scripts/audit-capture.mjs. Skips itself until a corpus exists.
  { name: 'corpus', entry: 'scripts/audit-corpus.mjs' },
].filter((s) => !only || s.name === only);

function findEsbuild() {
  const pnpmDir = join(root, 'node_modules/.pnpm');
  for (const dir of readdirSync(pnpmDir)) {
    if (!dir.startsWith('@esbuild+')) continue;
    const platform = dir.slice('@esbuild+'.length).split('@')[0];   // e.g. linux-x64
    const bin = join(pnpmDir, dir, 'node_modules/@esbuild', platform, 'bin/esbuild');
    if (existsSync(bin)) return bin;
  }
  return null;
}
const esbuild = findEsbuild();
if (!esbuild) {
  console.error('esbuild binary not found — run pnpm install');
  process.exit(1);
}

mkdirSync(join(root, '.cache'), { recursive: true });
let failed = false;
for (const suite of suites) {
  if (suite.needs && !existsSync(join(root, suite.needs))) {
    console.log(`\n— ${suite.name} — skipped: no build at ${suite.needs}`);
    continue;
  }
  const out = join(root, '.cache', `${suite.name}.bundle.mjs`);
  const build = spawnSync(esbuild, [join(root, suite.entry), '--bundle', '--platform=node', '--format=esm', `--outfile=${out}`, '--log-level=warning'], { stdio: 'inherit' });
  if (build.status !== 0) { failed = true; continue; }
  console.log(`\n— ${suite.name} —`);
  const run = spawnSync(process.execPath, [out], { stdio: 'inherit' });
  if (run.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
