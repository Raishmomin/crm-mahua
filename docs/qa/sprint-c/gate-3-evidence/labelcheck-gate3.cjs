// QA gate 3 check 6: label keys, Gujarati coverage, placeholders, jargon and hard-coded English in the
// files changed in Sprint C (src files newer than docs/qa/gate-2-regate.md), plus a tap-target scan of
// their Tailwind classes. Run from the repo root: npx tsx docs/qa/sprint-c/gate-3-evidence/labelcheck-gate3.cjs
const fs = require('fs');
const path = require('path');
const ROOT = '/home/raish/raish/mahua-crm';
const { LABELS } = require(ROOT + '/src/lib/labels.ts');
const DICTS = {
  QUOTE_LABELS: require(ROOT + '/src/app/(dashboard)/quotes/labels.ts').QUOTE_LABELS,
  BUYER_LABELS: require(ROOT + '/src/app/(dashboard)/buyers/labels.ts').BUYER_LABELS,
  SAMPLE_LABELS: require(ROOT + '/src/app/(dashboard)/samples/labels.ts').SAMPLE_LABELS,
  PAYMENT_LABELS: require(ROOT + '/src/app/(dashboard)/payments/labels.ts').PAYMENT_LABELS,
  CATALOG_LABELS: require(ROOT + '/src/app/(dashboard)/catalog/labels.ts').CATALOG_LABELS,
  INQUIRY_LABELS: require(ROOT + '/src/app/(dashboard)/inquiries/labels.ts').INQUIRY_LABELS,
  ORDER_LABELS: require(ROOT + '/src/app/(dashboard)/orders/labels.ts').ORDER_LABELS,
};

const ref = fs.statSync(ROOT + '/docs/qa/gate-2-regate.md').mtimeMs;
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const s = fs.statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(tsx?)$/.test(p) && s.mtimeMs > ref) files.push(p);
  }
})(ROOT + '/src');
console.log(`Sprint C changed src files (.ts/.tsx newer than the gate-2 re-gate report): ${files.length}`);
for (const f of files) console.log('  ' + path.relative(ROOT, f));

const KEY_RE = [
  /\btt\(\s*'([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)'/g,
  /\bt\(\s*[A-Za-z_.()]+\s*,\s*'([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)'/g,
  /messageKey:\s*'([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)'/g,
  /\b(?:labelKey|titleKey|emptyKey|wordKey|key|hintKey|errorKey):\s*'((?:msg|btn|field|nav|kpi|status|section|common|orders|payments|quotes|samples|buyers|inquiries|catalog|unit|title|wa|login)\.[a-z0-9_.]+)'/g,
  /'((?:title|wa|payments\.err|msg\.error|msg\.err|btn)\.[a-z0-9_.]+)'/g,
];
const missing = [];
const noGu = new Set();
let used = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const local = Object.keys(DICTS).filter((n) => src.includes(n));
  const keys = new Set();
  for (const re of KEY_RE) for (const m of src.matchAll(re)) keys.add(m[1]);
  for (const k of keys) {
    used++;
    const g = k in LABELS.en;
    const l = local.find((n) => k in DICTS[n].en) || Object.keys(DICTS).find((n) => k in DICTS[n].en);
    if (!g && !l) missing.push(`${k}  in ${path.relative(ROOT, f)}`);
    else if (g && !(k in LABELS.gu)) noGu.add('LABELS:' + k);
    else if (!g && l && !(k in DICTS[l].gu)) noGu.add(l + ':' + k);
  }
}
console.log(`\nliteral key uses: ${used}; missing keys: ${missing.length}`);
missing.forEach((m) => console.log('  MISSING ' + m));
console.log(`keys with English but no Gujarati: ${noGu.size}`);
noGu.forEach((k) => console.log('  NO-GU ' + k));

// Placeholders must match between en and gu (e.g. wa.dispatched {date}).
let ph = 0;
const all = [['LABELS', LABELS], ...Object.entries(DICTS)];
for (const [n, d] of all) for (const [k, en] of Object.entries(d.en)) {
  const gu = d.gu[k];
  if (gu === undefined) continue;
  const a = (en.match(/\{[a-z_]+\}/g) || []).sort().join(',');
  const b = (gu.match(/\{[a-z_]+\}/g) || []).sort().join(',');
  if (a !== b) { ph++; console.log(`  PLACEHOLDER MISMATCH ${n}[${k}] en(${a}) gu(${b})`); }
}
console.log(`placeholder mismatches en vs gu (all dictionaries): ${ph}`);

// The Sprint C keys the developers named, in both languages.
const NEW = [
  ['LABELS', 'wa.dispatched'], ['LABELS', 'msg.error.required'], ['LABELS', 'msg.error.too_long'], ['LABELS', 'btn.view_receipt'],
  ['LABELS', 'wa.receipt'], ['PAYMENT_LABELS', 'payments.err.future_date'], ['PAYMENT_LABELS', 'payments.err.over_payment'],
  ['LABELS', 'payments.err.future_date'], ['LABELS', 'payments.err.over_payment'],
];
console.log('\nSprint C keys (en | gu):');
for (const [n, k] of NEW) {
  const d = n === 'LABELS' ? LABELS : DICTS[n];
  if (!(k in d.en)) continue;
  console.log(`  ${n}[${k}]: ${JSON.stringify(d.en[k])} | ${JSON.stringify(d.gu[k])}`);
}
const titleKeys = Object.keys(LABELS.en).filter((k) => k.startsWith('title.'));
console.log(`  title.* keys: ${titleKeys.length}; without gu: ${titleKeys.filter((k) => !(k in LABELS.gu)).length}`);
const fullDue = Object.entries(DICTS.PAYMENT_LABELS.en).filter(([k]) => /full_due|due_hint|prefill/.test(k));
fullDue.forEach(([k, v]) => console.log(`  PAYMENT_LABELS[${k}]: ${JSON.stringify(v)} | ${JSON.stringify(DICTS.PAYMENT_LABELS.gu[k])}`));

// Jargon in every label value a user reads, and in JSX text of the changed files.
const JARGON = /\b(Tenant|RLS|fn_[a-z_]+|Receivables?|Immutable|Entitlements?|Preset|Pipeline|Opportunit(?:y|ies)|SKU|Fulfil?ment|Payload|Lead|Overpayment|Invalid|Unauthori[sz]ed|Forbidden|Exception|Null)\b/i;
let j = 0;
for (const [n, d] of all) for (const [k, v] of Object.entries(d.en)) if (JARGON.test(v)) { j++; console.log(`  JARGON ${n}.en[${k}] = ${v}`); }
let hard = 0;
for (const f of files.filter((x) => x.endsWith('.tsx'))) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const tr = line.trim();
    if (tr.startsWith('//') || tr.startsWith('*') || tr.startsWith('{/*')) return;
    for (const m of line.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) if (JARGON.test(m[1])) { j++; console.log(`  JARGON jsx ${path.relative(ROOT, f)}:${i + 1}: ${m[1].trim()}`); }
    for (const m of line.matchAll(/>\s*([A-Z][a-z]+(?:\s+[a-z]+){1,})\s*</g)) { hard++; console.log(`  HARDCODED ${path.relative(ROOT, f)}:${i + 1}: "${m[1]}"`); }
  });
}
console.log(`\njargon hits: ${j}; hard-coded English text nodes (2+ words): ${hard}`);

// Tap targets: interactive elements in the changed .tsx files whose class gives a height under 44px.
let small = 0;
for (const f of files.filter((x) => x.endsWith('.tsx'))) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const sm = line.match(/size="sm"/) || line.match(/\bh-(?:6|7|8|9|10)\b(?![\]\/])/) || line.match(/min-h-\[(?:[0-3]\d|4[0-3])px\]/);
    if (!sm) return;
    const ctx = lines.slice(Math.max(0, i - 3), i + 2).join(' ');
    if (/<(Button|button|Link|a)\b/.test(ctx) && !/aria-hidden|<svg|className="h-\d+ w-\d+"/.test(line)) { small++; console.log(`  SMALL? ${path.relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 140)}`); }
  });
}
console.log(`possible tap targets under 44px in changed files: ${small}`);
