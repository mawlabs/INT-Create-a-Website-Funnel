#!/usr/bin/env node
/**
 * Counts un-reviewed French strings (`_review: true`) and open `TODO(angelique)` items across every site.
 * Prints the counts; with --strict (used on main) exits non-zero if either count is non-zero.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const strict = process.argv.includes('--strict');
const root = new URL('..', import.meta.url).pathname;
const sitesDir = join(root, 'sites');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(json|mdx?|ts|astro|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

function countReview(node, path, hits) {
  if (Array.isArray(node)) node.forEach((n, i) => countReview(n, `${path}[${i}]`, hits));
  else if (node && typeof node === 'object') {
    if (node._review === true) hits.push(path || '(root)');
    for (const [k, v] of Object.entries(node)) if (k !== '_review') countReview(v, path ? `${path}.${k}` : k, hits);
  }
}

let review = 0;
let todos = 0;
for (const site of readdirSync(sitesDir)) {
  const src = join(sitesDir, site, 'src');
  let files = [];
  try { files = walk(src); } catch { continue; }
  const reviewHits = [];
  const todoHits = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    if (f.endsWith('.json')) countReview(JSON.parse(text), '', reviewHits.length ? reviewHits : reviewHits);
    if (f.endsWith('.mdx') && /^review:\s*true/m.test(text)) reviewHits.push(f.replace(root, ''));
    for (const m of text.matchAll(/TODO\(angelique\)[^\n"]*/g)) todoHits.push(`${f.replace(root, '')}: ${m[0].slice(0, 100)}`);
  }
  console.log(`\n${site}: ${reviewHits.length} FR node(s) awaiting review, ${todoHits.length} TODO(angelique) item(s)`);
  if (process.argv.includes('--list')) {
    reviewHits.forEach((h) => console.log(`  review  ${h}`));
    todoHits.forEach((h) => console.log(`  todo    ${h}`));
  }
  review += reviewHits.length;
  todos += todoHits.length;
}
console.log(`\nTotal: FR-review=${review} TODO(angelique)=${todos}`);
if (strict && (review > 0 || todos > 0)) {
  console.error('\nmain cannot deploy while FR-review or TODO(angelique) counts are non-zero (CLAUDE.md #2, brief §9.2, §14).');
  process.exit(1);
}
