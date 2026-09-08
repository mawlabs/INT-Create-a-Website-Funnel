#!/usr/bin/env node
/** Exercises the quote engine over every branch: each flow completes, prices are sane and monotonic. */
import { stepsFor, nextStep, computeQuote, buildLeadPayload, PROJECT_TYPES, ALL_STEPS } from '../packages/lander-kit/lib/quote.ts';
import { pricing } from '../sites/createawebsite-ca/src/data/pricing.ts';

let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };

function fill(answers, pick) {
  let guard = 0;
  for (;;) {
    const step = nextStep(answers);
    if (!step) return answers;
    answers[step.id] = step.multi ? [pick(step)] : pick(step);
    if (++guard > 30) throw new Error('loop');
  }
}

// every combination of first options completes and prices
for (const type of PROJECT_TYPES) {
  const a = fill({ projectType: type }, (s) => s.options[0]);
  const q = computeQuote(a, pricing);
  ok(q, `${type}: quote null`);
  if (q?.kind === 'quote') {
    ok(q.price.low < q.price.high, `${type}: price order`);
    ok(q.hours.low < q.hours.high, `${type}: hours order`);
    ok(q.weeks.low < q.weeks.high, `${type}: weeks order`);
    ok(q.price.low >= 85, `${type}: min price`);
  }
  console.log(type.padEnd(10), JSON.stringify(q?.kind === 'quote' ? { price: q.price, hours: q.hours, weeks: q.weeks, c: q.complexity, base: q.base } : q));
}

// exhaustive: walk every option at every step (depth-first) and check monotonic sanity
let count = 0;
function walk(answers) {
  const step = nextStep(answers);
  if (!step) {
    const q = computeQuote(answers, pricing);
    ok(q, 'null at complete');
    if (q?.kind === 'quote') ok(q.price.low <= q.price.high && q.hours.low <= q.hours.high, `order ${JSON.stringify(answers)}`);
    count++;
    return;
  }
  for (const opt of step.options) walk({ ...answers, [step.id]: step.multi ? [opt] : opt });
}
walk({});
console.log('paths walked:', count);

// rush costs more than standard; bilingual costs more than single
const neutral = { timeline: 'standard', multilingual: 'single', design: 'inspiration', integrations: 'none', pages: 'p1_5', blog: 'no', platform: 'wordpress', approach: 'builder' };
const base = fill({ projectType: 'business' }, (s) => neutral[s.id] ?? s.options[0]);
const rush = { ...base, timeline: 'rush' };
const bil = { ...base, multilingual: 'bilingual' };
const qb = computeQuote(base, pricing), qr = computeQuote(rush, pricing), qm = computeQuote(bil, pricing);
ok(qr.price.high > qb.price.high && qr.weeks.high <= qb.weeks.high, 'rush pricier and faster');
ok(qm.price.low > qb.price.low, 'bilingual pricier');
ok(qb.price.low === 2500 && qb.price.high === 3500, `basic business base is the published tier: ${qb.price.low}-${qb.price.high}`);
console.log('basic business:', qb.price, qb.hours, qb.weeks, qb.breakdown);

// the breakdown always adds up to the quoted hours
for (const type of PROJECT_TYPES) {
  const a = fill({ projectType: type }, (s) => s.options[0]);
  const q = computeQuote(a, pricing);
  if (q?.kind !== 'quote') continue;
  const b = q.breakdown;
  const low = b.design.low + b.development.low + b.content.low + b.testing.low;
  const high = b.design.high + b.development.high + b.content.high + b.testing.high;
  ok(low === q.hours.low && high === q.hours.high, `${type}: breakdown sums to the total (${low}-${high} vs ${q.hours.low}-${q.hours.high})`);
}

// providing a finished design removes the design phase from the quote
const ready = { ...base, design: 'ready' };
const scratch = { ...base, design: 'scratch' };
const qReady = computeQuote(ready, pricing), qScratch = computeQuote(scratch, pricing);
ok(qReady.designProvided && !qScratch.designProvided, 'designProvided flag');
ok(qReady.breakdown.design.high < qScratch.breakdown.design.high / 3, `design phase shrinks: ${qReady.breakdown.design.high} vs ${qScratch.breakdown.design.high}`);
ok(qReady.price.high < qScratch.price.high, `price drops when the design is provided: ${qReady.price.high} vs ${qScratch.price.high}`);
ok(qReady.breakdown.development.high === qScratch.breakdown.development.high, 'other phases are unchanged');
console.log('design provided:', qReady.price, qReady.hours, qReady.breakdown.design, 'vs from scratch:', qScratch.price, qScratch.hours, qScratch.breakdown.design);

// changing a branch prunes stale answers
const s1 = stepsFor({ projectType: 'business', platform: 'wordpress' }).map((s) => s.id);
const s2 = stepsFor({ projectType: 'business', platform: 'fullyCustom' }).map((s) => s.id);
ok(s1.includes('approach') && !s2.includes('approach'), 'approach skipped for fully custom');

// lead payload
const payload = buildLeadPayload({ name: 'Test', email: ' T@Example.com ', locale: 'fr', answers: base, result: qb, summaryLines: ['Type: business'], sessionId: 'caw-x', source: { domain: 'createawebsite.ca' } });
ok(payload.email === 't@example.com' && payload.quoted_range_low === 2500 && payload.complexity === 'simple', `payload ${JSON.stringify(payload)}`);
console.log('all step ids:', ALL_STEPS.map((s) => s.id).join(','));
console.log(fails ? `${fails} failure(s)` : 'quote engine OK');
process.exit(fails ? 1 : 0);
