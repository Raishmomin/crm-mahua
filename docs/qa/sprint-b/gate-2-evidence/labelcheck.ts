// QA gate 2 check 6: label keys used in Sprint B code exist; jargon in user-visible strings.
// Run from the repo root: npx tsx <this file>
import * as fs from 'fs';
import * as path from 'path';
import { LABELS } from '/home/raish/raish/mahua-crm/src/lib/labels';
import { QUOTE_LABELS } from '/home/raish/raish/mahua-crm/src/app/(dashboard)/quotes/labels';
import { BUYER_LABELS } from '/home/raish/raish/mahua-crm/src/app/(dashboard)/buyers/labels';
import { SAMPLE_LABELS } from '/home/raish/raish/mahua-crm/src/app/(dashboard)/samples/labels';
import { PAYMENT_LABELS } from '/home/raish/raish/mahua-crm/src/app/(dashboard)/payments/labels';
import { CATALOG_LABELS } from '/home/raish/raish/mahua-crm/src/app/(dashboard)/catalog/labels';
import { INQUIRY_LABELS } from '/home/raish/raish/mahua-crm/src/app/(dashboard)/inquiries/labels';
import { ORDER_LABELS } from '/home/raish/raish/mahua-crm/src/app/(dashboard)/orders/labels';

const ROOT = '/home/raish/raish/mahua-crm';
const DICTS: Record<string, { en: Record<string, string>; gu: Partial<Record<string, string>> }> = {
  QUOTE_LABELS, BUYER_LABELS, SAMPLE_LABELS, PAYMENT_LABELS, CATALOG_LABELS, INQUIRY_LABELS, ORDER_LABELS,
};
const DIRS = [
  'src/app/(dashboard)/inquiries', 'src/app/(dashboard)/buyers', 'src/app/(dashboard)/samples', 'src/app/(dashboard)/quotes',
  'src/app/(dashboard)/orders', 'src/app/(dashboard)/payments', 'src/app/(dashboard)/catalog', 'src/app/(print)',
  'src/components/inquiries', 'src/components/buyers', 'src/components/followups', 'src/components/samples',
  'src/components/quotes', 'src/components/orders', 'src/components/payments', 'src/components/catalog', 'src/components/home',
  'src/app/(dashboard)/page.tsx', 'src/app/(dashboard)/home-actions.ts',
];
function walk(p: string, out: string[]) {
  const abs = path.join(ROOT, p);
  if (!fs.existsSync(abs)) return;
  if (fs.statSync(abs).isFile()) { if (/\.(tsx?|js)$/.test(abs)) out.push(abs); return; }
  for (const f of fs.readdirSync(abs)) walk(path.join(p, f), out);
}
const files: string[] = [];
DIRS.forEach((d) => walk(d, files));

const KEY_RE = [
  /\btt\(\s*'([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)'/g,
  /\btt\(\s*"([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)"/g,
  /\bt\(\s*[A-Za-z_.()]+\s*,\s*'([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)'/g,
  /messageKey:\s*'([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)'/g,
  /\bmessage(?:Key)?=["']([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)["']/g,
  /\b(?:labelKey|titleKey|emptyKey|wordKey|key):\s*'((?:msg|btn|field|nav|kpi|status|section|common|orders|payments|quotes|samples|buyers|inquiries|catalog|unit)\.[a-z0-9_.]+)'/g,
];
const DYN_RE = /\b(?:tt|t)\([^)]*?`([a-z_.]+)\$\{/g;

let missing: { file: string; key: string; dicts: string[] }[] = [];
let used = 0;
const dyn = new Set<string>();
const guMissing = new Set<string>();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const dictNames = Object.keys(DICTS).filter((n) => src.includes(n));
  const keys = new Set<string>();
  for (const re of KEY_RE) for (const m of Array.from(src.matchAll(re))) keys.add(m[1]);
  for (const m of Array.from(src.matchAll(DYN_RE))) dyn.add(m[1] + '${…}  (' + path.relative(ROOT, f) + ')');
  for (const k of Array.from(keys)) {
    used++;
    const inGlobal = k in LABELS.en;
    const local = dictNames.find((n) => k in DICTS[n].en);
    if (!inGlobal && !local) missing.push({ file: path.relative(ROOT, f), key: k, dicts: dictNames });
    else if (!inGlobal && local && !(k in DICTS[local].gu)) guMissing.add(`${local}:${k}`);
    else if (inGlobal && !local && !(k in LABELS.gu)) guMissing.add(`LABELS:${k}`);
  }
}
console.log(`files scanned: ${files.length}; literal key uses: ${used}; missing keys: ${missing.length}`);
for (const m of missing) console.log(`  MISSING ${m.key}  in ${m.file}  (local dicts: ${m.dicts.join(',') || 'none'})`);
console.log(`keys used with an English text but no Gujarati text: ${guMissing.size}`);
for (const k of Array.from(guMissing).slice(0, 40)) console.log('  NO-GU ' + k);
console.log(`dynamic key prefixes (checked below against DB codes): ${dyn.size}`);
for (const d of Array.from(dyn).slice(0, 60)) console.log('  DYN ' + d);

// DB codes -> label keys
const CODES: Record<string, string[]> = {
  'status.inquiry': ['new', 'talking', 'sample_sent', 'quoted', 'won', 'lost'],
  'status.sample': ['to_send', 'sent', 'approved', 'rejected'],
  'status.quote': ['draft', 'sent', 'accepted', 'rejected', 'expired'],
  'status.order': ['confirmed', 'in_production', 'ready', 'dispatched', 'delivered', 'cancelled'],
  'status.dispatch': ['dispatched', 'delivered'],
  'status.money': ['paid', 'due', 'overdue'],
  'source': ['whatsapp', 'call', 'visit', 'email', 'indiamart'],
  'lost_reason': ['price', 'quality', 'timing', 'no_reply'],
  'pay_mode': ['cash', 'bank', 'upi', 'cheque', 'lc'],
  'dispatch_mode': ['truck', 'container'],
  'checklist': ['container_booked', 'stuffing_done', 'coa', 'phyto', 'coo', 'fumigation', 'invoice_packing_list', 'bl_received'],
  'incoterm': ['EXW', 'FOB_Pipavav', 'FOB_Mundra', 'CIF'],
};
let codeMiss = 0;
for (const [pre, codes] of Object.entries(CODES)) for (const c of codes) {
  const k = `${pre}.${c}`;
  if (!(k in LABELS.en)) { codeMiss++; console.log('  CODE-MISSING en ' + k); }
  if (!(k in LABELS.gu)) { codeMiss++; console.log('  CODE-MISSING gu ' + k); }
}
console.log(`DB code -> label key gaps: ${codeMiss}`);

// Jargon: words in label VALUES (what users read) and in JSX text of the new files
const JARGON = /\b(Tenant|RLS|fn_[a-z_]+|Receivables?|Immutable|Entitlements?|Preset|Pipeline|Opportunit(?:y|ies)|SKU|Fulfil?ment|Payload|Lead)\b/i;
let jHits = 0;
const allDicts: [string, Record<string, string>][] = [['LABELS.en', LABELS.en], ...Object.entries(DICTS).map(([n, d]) => [n + '.en', d.en] as [string, Record<string, string>])];
for (const [n, d] of allDicts) for (const [k, v] of Object.entries(d)) if (JARGON.test(v)) { jHits++; console.log(`  JARGON value ${n}[${k}] = ${v}`); }
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('import')) return;
    // JSX text between tags, or string literals rendered directly
    const jsxText = Array.from(line.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)).map((m) => m[1]);
    for (const tx of jsxText) if (JARGON.test(tx)) { jHits++; console.log(`  JARGON jsx ${path.relative(ROOT, f)}:${i + 1}: ${tx.trim()}`); }
  });
}
console.log(`jargon hits in user-visible strings: ${jHits}`);

// Hard-coded English in JSX (text nodes that are not keys/vars)
let hard = 0;
for (const f of files.filter((x) => x.endsWith('.tsx'))) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const m of Array.from(line.matchAll(/>\s*([A-Z][a-z]+(?:\s+[a-z]+){1,})\s*</g))) { hard++; console.log(`  HARDCODED ${path.relative(ROOT, f)}:${i + 1}: "${m[1]}"`); }
  });
}
console.log(`hard-coded English text nodes (2+ words): ${hard}`);
