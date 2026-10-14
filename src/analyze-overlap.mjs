// Overlap analysis across the 23 Weblio dialect dictionaries.
//
//   node src/analyze-overlap.mjs            # human-readable report
//   node src/analyze-overlap.mjs --json     # machine-readable summary
//
// Answers three questions:
//   1. 词形重合  how many written forms appear in more than one dictionary
//   2. 意思重合  of those, how many actually share a meaning (same 共通語訳)
//                and how many are 同形异义 (same form, different meaning)
//   3. 与共通語重合 how much of the dialect vocabulary is itself ordinary
//                Japanese (a headword that is also used as a 共通語訳)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DICTS = JSON.parse(readFileSync(join(ROOT, "dictionaries.json"), "utf8"));

// --- normalisation --------------------------------------------------------

const KATAKANA = /[\u30A1-\u30F6]/g;
const kana = (s) => s.replace(KATAKANA, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** Fold a written form to a comparison key. */
function norm(s) {
  let t = String(s || "").normalize("NFKC");
  t = kana(t);
  t = t.replace(/[～~〜・･\s　]/g, "");
  t = t.replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, "");
  t = t.replace(/^[「『（(【]+|[」』）)】]+$/g, "");
  t = t.replace(/[。、！？!?、,，]+$/g, "");
  return t.trim();
}

/** A form worth comparing: 2–30 chars, not pure latin/digits. */
function usable(key) {
  if (!key || key.length < 2 || key.length > 30) return false;
  if (/^[0-9a-z]+$/.test(key)) return false;
  if (/^[ぁ-ゖー]{4,}$/.test(key) && new Set(key).size === 1) return false; // ああああ
  return true;
}

/** The core of a gloss: first clause, decorations stripped. */
function meaningKey(gloss) {
  let g = String(gloss || "").normalize("NFKC");
  g = g.replace(/【[^】]*】/g, " ");
  g = g.replace(/[（(][^）)]{0,20}[）)]/g, " ");
  g = g.split(/[。．.!?！？；;\n]/)[0];
  g = g.split(/[、，,]/)[0];
  return norm(g);
}

// --- read every snapshot --------------------------------------------------

const MEANING_HEADER = /意味|共通語|訳|語意|解説|説明|用法/;

function meaningOf(entry) {
  if (entry.mode === "table" && Array.isArray(entry.rows) && entry.rows.length >= 2) {
    const head = entry.rows[0] || [];
    let col = head.findIndex((h) => MEANING_HEADER.test(String(h)));
    if (col < 0) col = head.length > 1 ? 1 : -1;
    const row = entry.rows[1] || [];
    return String(row[col] ?? "").trim();
  }
  if (entry.mode === "spans") return String(entry.gloss || "").trim();
  return String(entry.text || "").split("\n").find((l) => l.trim())?.trim() || "";
}

/** True when the dictionary's meaning column is explicitly labelled 共通語/訳語,
 *  i.e. guaranteed to be written in standard Japanese (no dialect leakage). */
function hasStandardColumn(entry) {
  if (entry.mode !== "table" || !Array.isArray(entry.rows) || !entry.rows.length) return false;
  return (entry.rows[0] || []).some((h) => /共通語|訳語/.test(String(h)));
}

const dicts = [];
for (const d of DICTS) {
  const raw = JSON.parse(readFileSync(join(ROOT, "data", `${d.slug}.json`), "utf8"));
  const forms = new Map(); // key -> { display, meanings:Set, strict:Set, selfId }
  let strictCol = 0;
  for (const e of raw.entries) {
    const key = norm(e.headword);
    if (!usable(key)) continue;
    if (!forms.has(key)) forms.set(key, { display: e.headword, meanings: new Set(), strict: new Set(), selfId: false });
    const g = meaningOf(e);
    const mk = meaningKey(g);
    const rec = forms.get(key);
    if (mk) rec.meanings.add(mk);
    if (mk && mk === key) rec.selfId = true;
    if (hasStandardColumn(e)) {
      strictCol++;
      if (mk) rec.strict.add(mk);
    }
  }
  dicts.push({ slug: d.slug, name: d.name, count: raw.count, forms, strictCol });
}

// --- 1. form overlap ------------------------------------------------------

const owners = new Map(); // key -> Map(slug -> Set(meaning))
for (const d of dicts) {
  for (const [k, v] of d.forms) {
    if (!owners.has(k)) owners.set(k, new Map());
    owners.get(k).set(d.slug, v.meanings);
  }
}
const allKeys = [...owners.keys()];
const sharedKeys = allKeys.filter((k) => owners.get(k).size >= 2);

const buckets = { "1": 0, "2": 0, "3-5": 0, "6-10": 0, "11+": 0 };
for (const k of allKeys) {
  const n = owners.get(k).size;
  if (n === 1) buckets["1"]++;
  else if (n === 2) buckets["2"]++;
  else if (n <= 5) buckets["3-5"]++;
  else if (n <= 10) buckets["6-10"]++;
  else buckets["11+"]++;
}

// --- 2. meaning agreement among shared forms ------------------------------

const agree = []; // same form, at least two dictionaries share a meaning
const agreeFull = []; // same form, every dictionary shares the same meaning
const disagree = []; // same form, no shared meaning (同形异义)
for (const k of sharedKeys) {
  const per = [...owners.get(k).entries()]; // [slug, meanings]
  const counts = new Map();
  for (const [, ms] of per) for (const m of ms) counts.set(m, (counts.get(m) || 0) + 1);
  let best = null;
  for (const [m, c] of counts) if (!best || c > best.c) best = { meaning: m, c };
  const common = best && best.c >= 2 ? best : null;
  const full = best && best.c === per.length ? best : null;
  const meanings = per.map(([s, ms]) => `${s}: ${[...ms][0] || ""}`);
  const rec = { key: k, n: per.length, slugs: per.map(([s]) => s), common, full, meanings };
  if (common) agree.push(rec);
  if (full) agreeFull.push(rec);
  if (!common) disagree.push(rec);
}
agree.sort((a, b) => b.n - a.n || b.common.c - a.common.c);
agreeFull.sort((a, b) => b.n - a.n);
disagree.sort((a, b) => b.n - a.n);

// --- 3. overlap with standard Japanese ------------------------------------

// Two tiers, because a dictionary's 意味 column usually *is* standard Japanese
// but occasionally glosses one dialect word with another.
//   strict — only columns explicitly headed 共通語/訳語 (pure standard Japanese)
//   loose  — every 意味 column
const strictVocab = new Set();
const looseVocab = new Set();
for (const d of dicts) {
  for (const v of d.forms.values()) {
    for (const m of v.meanings) if (usable(m) && m.length <= 14) looseVocab.add(m);
    for (const m of v.strict) if (usable(m) && m.length <= 14) strictVocab.add(m);
  }
}

const perDict = [];
for (const d of dicts) {
  let strict = 0, loose = 0, selfId = 0;
  const exStrict = [], exLoose = [];
  for (const [k, v] of d.forms) {
    if (strictVocab.has(k)) { strict++; if (exStrict.length < 6) exStrict.push(v.display); }
    if (looseVocab.has(k)) { loose++; if (exLoose.length < 6) exLoose.push(v.display); }
    if (v.selfId) selfId++;
  }
  perDict.push({
    slug: d.slug, name: d.name, total: d.forms.size,
    strict, loose, selfId, strictCol: d.strictCol,
    pctStrict: d.forms.size ? (strict / d.forms.size) * 100 : 0,
    pctLoose: d.forms.size ? (loose / d.forms.size) * 100 : 0,
    exStrict, exLoose,
  });
}
const totalStrict = allKeys.filter((k) => strictVocab.has(k)).length;
const totalLoose = allKeys.filter((k) => looseVocab.has(k)).length;
let selfIdForms = 0;
for (const d of dicts) for (const v of d.forms.values()) if (v.selfId) selfIdForms++;

// --- 4. shared concepts ---------------------------------------------------

const conceptOwner = new Map();
for (const d of dicts) {
  for (const v of d.forms.values()) {
    for (const m of v.meanings) {
      if (!usable(m) || m.length > 10) continue;
      if (!conceptOwner.has(m)) conceptOwner.set(m, new Set());
      conceptOwner.get(m).add(d.slug);
    }
  }
}
const topConcepts = [...conceptOwner]
  .map(([c, s]) => ({ concept: c, n: s.size }))
  .filter((c) => c.n >= 4)
  .sort((a, b) => b.n - a.n || (a.concept < b.concept ? -1 : 1))
  .slice(0, 30);

// pairwise
const pairs = [];
for (let i = 0; i < dicts.length; i++) {
  for (let j = i + 1; j < dicts.length; j++) {
    const a = dicts[i].forms, b = dicts[j].forms;
    let inter = 0;
    for (const k of a.keys()) if (b.has(k)) inter++;
    pairs.push({
      a: dicts[i].slug, b: dicts[j].slug, inter,
      jaccard: inter / (a.size + b.size - inter),
      ratio: inter / Math.min(a.size, b.size),
    });
  }
}
pairs.sort((x, y) => y.inter - x.inter);

// full matrix in dictionary order, for the heat-map
const order = dicts.map((d) => d.slug);
const matrix = dicts.map((a) =>
  dicts.map((b) => {
    if (a === b) return 1;
    let inter = 0;
    for (const k of a.forms.keys()) if (b.forms.has(k)) inter++;
    const uni = a.forms.size + b.forms.size - inter;
    return uni ? inter / uni : 0;
  }),
);
const dictList = dicts.map((d) => ({ slug: d.slug, name: d.name, entries: d.count, forms: d.forms.size }));

const out = {
  dictionaries: dicts.length,
  totalEntries: dicts.reduce((a, d) => a + d.count, 0),
  totalForms: allKeys.length,
  sharedForms: sharedKeys.length,
  sharedPct: (sharedKeys.length / allKeys.length) * 100,
  buckets,
  order,
  matrix,
  dictList,
  meaningAgree: agree.length,
  meaningAgreeFull: agreeFull.length,
  meaningDisagree: disagree.length,
  agreePctOfShared: (agree.length / sharedKeys.length) * 100,
  disagreePctOfShared: (disagree.length / sharedKeys.length) * 100,
  topAgree: agree.slice(0, 30),
  topAgreeFull: agreeFull.slice(0, 20),
  topDisagree: disagree.slice(0, 30),
  perDict: perDict.sort((a, b) => b.pctStrict - a.pctStrict),
  totalStrict,
  totalLoose,
  selfIdForms,
  pctStrict: (totalStrict / allKeys.length) * 100,
  pctLoose: (totalLoose / allKeys.length) * 100,
  strictVocab: strictVocab.size,
  looseVocab: looseVocab.size,
  topConcepts,
  topPairs: pairs.slice(0, 15),
  leastPairs: pairs.slice(-8).reverse(),
};

export { out, owners, dicts, meaningOf, norm, meaningKey };

const isMain = process.argv[1] && process.argv[1].endsWith("analyze-overlap.mjs");

if (isMain && process.argv.includes("--json")) {
  console.log(JSON.stringify(out, null, 1));
} else if (isMain) {
  const f = (n) => n.toLocaleString("en-US");
  console.log(`dictionaries        ${out.dictionaries}`);
  console.log(`total entries       ${f(out.totalEntries)}`);
  console.log(`unique forms        ${f(out.totalForms)}`);
  console.log(`shared forms (>=2)  ${f(out.sharedForms)}  (${out.sharedPct.toFixed(1)}%)`);
  console.log(`  buckets           ${JSON.stringify(buckets)}`);
  console.log(`\nmeaning agreement among shared forms:`);
  console.log(`  agree (>=2 dicts) ${f(out.meaningAgree)}  (${out.agreePctOfShared.toFixed(1)}% of shared)`);
  console.log(`  agree (all dicts) ${f(out.meaningAgreeFull)}`);
  console.log(`  disagree (同形异义) ${f(out.meaningDisagree)}  (${out.disagreePctOfShared.toFixed(1)}%)`);
  console.log(`\ntop agreeing forms:`);
  for (const r of agree.slice(0, 20)) console.log(`  ${r.key.padEnd(10)} x${String(r.n).padStart(2)}  “${r.common.meaning}” (${r.common.c})`);
  console.log(`\ntop 同形异义 (same form, different meaning):`);
  for (const r of disagree.slice(0, 20)) {
    const ms = [...owners.get(r.key).values()].map((s) => [...s][0]).slice(0, 3);
    console.log(`  ${r.key.padEnd(10)} x${String(r.n).padStart(2)}  ${ms.join(" / ")}`);
  }
  console.log(`\nstandard-Japanese vocabulary (strict 共通語/訳語 cols): ${f(out.strictVocab)}`);
  console.log(`  headwords that are a standard word: ${f(out.totalStrict)} (${out.pctStrict.toFixed(1)}%)`);
  console.log(`standard-Japanese vocabulary (loose, all 意味 cols): ${f(out.looseVocab)}`);
  console.log(`  headwords that are a standard word: ${f(out.totalLoose)} (${out.pctLoose.toFixed(1)}%)`);
  console.log(`  headwords equal to their own gloss: ${f(out.selfIdForms)}`);
  console.log(`\nper dictionary (strict / loose):`);
  for (const p of out.perDict) {
    console.log(`  ${p.slug.padEnd(8)} ${String(p.total).padStart(5)} forms  strict ${String(p.strict).padStart(4)} (${p.pctStrict.toFixed(1)}%)  loose ${String(p.loose).padStart(4)} (${p.pctLoose.toFixed(1)}%)  ${p.exStrict.slice(0, 4).join(" ")}`);
  }
  console.log(`\nconcepts shared by >=4 dialects:`);
  for (const c of topConcepts) console.log(`  ${c.concept.padEnd(12)} ${c.n}`);
  console.log(`\nclosest dictionary pairs (by shared forms):`);
  for (const p of out.topPairs) console.log(`  ${p.a}-${p.b}  ${p.inter}  jaccard=${p.jaccard.toFixed(3)}`);
}
