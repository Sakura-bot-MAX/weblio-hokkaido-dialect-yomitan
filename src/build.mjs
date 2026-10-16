// Build one Yomitan (format 3) dictionary per dialect from data/<slug>.json.
//
//   node src/build.mjs              # every snapshot that exists
//   node src/build.mjs --slug=osaka
//
// Each dictionary gets its own dist/<slug>/{index.json,term_bank_1.json,<zip>}
// and self-updates from a per-dictionary release tag, so installing one
// dialect does not drag in the other twenty-two.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import { makeZip } from "./zip.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// GitHub repository that hosts the releases, as "owner/name".
// The update workflow passes this explicitly via GITHUB_REPOSITORY, so the
// fallback only matters for local runs.
//
// The fallback must be the repository's *current* name. index.json embeds its
// own release URLs, so if this string and GITHUB_REPOSITORY disagree, every
// dictionary gets rebuilt with a different URL and CI commits a "change" that
// no upstream data caused. (A renamed repository still redirects, which is why
// the mismatch is easy to miss.)
export const REPO =
  process.env.YOMITAN_REPO ||
  process.env.GITHUB_REPOSITORY ||
  "dtotaku/weblio-dialect-yomitan-dictionaries";

// --- helpers --------------------------------------------------------------
//
// Everything below is exported so src/build-merged.mjs can assemble the
// "all dialects in one" edition from exactly the same parsing rules. The
// per-dialect output must not change when those helpers move, so the shared
// entry points keep their signatures.

/** Split a 漢字表記 field into searchable spellings, expanding okurigana
 *  parentheses: '骨付(き)ざんぎ・骨附(き)ざんぎ' ->
 *  ['骨付ざんぎ','骨付きざんぎ','骨附ざんぎ','骨附きざんぎ'] */
export function kanjiVariants(field) {
  const out = [];
  for (const raw of String(field || "").split(/[・･/、]/)) {
    const part = raw.trim().replace(/^【|】$/g, "");
    if (!part) continue;
    if (!out.includes(part)) out.push(part);
    for (const m of part.matchAll(/[（(]([^）)]*)[）)]/g)) {
      const inner = m[1];
      const before = part.slice(0, m.index);
      const after = part.slice(m.index + m[0].length);
      for (const form of [before + after, before + inner + after]) {
        if (form && !out.includes(form)) out.push(form);
      }
    }
  }
  return out;
}

/** Merge every written form of one word (same reading + pos + gloss) into a
 *  single entry, unioning all of its kanji spellings and index labels. */
export function mergeForms(rows) {
  const groups = new Map();
  for (const x of rows) {
    if (!x.headword) continue;
    const reading = x.reading || x.headword;
    const key = JSON.stringify([reading, x.pos || [], x.gloss || "", x.text || "", x.rows || null]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(x);
  }

  const merged = [];
  for (const items of groups.values()) {
    const primary = { ...items[0] };
    const kanji = [];
    const labels = [];
    const variants = [];
    for (const item of items) {
      for (const k of kanjiVariants(item.kanji)) {
        if (k && !kanji.includes(k)) kanji.push(k);
      }
      if (item.label && !labels.includes(item.label)) labels.push(item.label);
      for (const v of item.variants || []) if (!variants.includes(v)) variants.push(v);
    }
    if (kanji.length) primary.kanji = kanji.join("・");
    primary.labels = labels;
    primary.variants = variants;
    merged.push(primary);
  }
  return merged;
}

/** Strip pitch-accent notation so the reading stays a clean search key. */
export function cleanReading(s) {
  return String(s || "")
    .replace(/[・△]/g, "")
    .replace(/[〈（(\[][^〉）)\]]*[〉）)\]]/g, "")
    .trim();
}

const KANA_ONLY = /^[\u3041-\u309F\u30A0-\u30FF\u30FC\u30FB\u30FD\u30FEー]+$/;

/**
 * The reading Yomitan should index. 北海道-style entries carry an explicit
 * <span class=ve> reading; the table dictionaries only expose the heading, so
 * fall back to any kana-only form we know about (index label first), which
 * turns 博多弁 "お・る【居る】" into the reading "おる".
 */
export function entryReading(entry) {
  if (entry.reading) return cleanReading(entry.reading);
  const cands = [entry.label, ...(entry.labels || []), entry.headword, ...(entry.variants || [])];
  for (const c of cands) {
    const t = String(c || "").trim();
    if (t && KANA_ONLY.test(t)) return t;
  }
  return String(entry.headword || entry.label || "").trim();
}

/** Index labels are the site's own lookup keys; drop ones that are unusable. */
export function usableLabel(s) {
  const t = String(s || "").trim();
  if (!t || t.length > 40) return false;
  if (/^\d+$/.test(t)) return false;
  return true;
}

const bold = (content) => ({ tag: "span", content, style: { fontWeight: "bold" } });
const td = (content) => ({ tag: "td", content });
const th = (content) => ({ tag: "th", content, style: { textAlign: "left" } });

/** Render the definition body in whichever shape the source page used. */
function renderBody(entry) {
  if (entry.mode === "table" && Array.isArray(entry.rows) && entry.rows.length) {
    const [head, ...rest] = entry.rows;
    const body = [
      { tag: "tr", content: head.map((c) => th(c || "--")) },
      ...rest.map((row) => ({ tag: "tr", content: row.map((c) => td(c || "--")) })),
    ];
    return { tag: "table", content: { tag: "tbody", content: body } };
  }

  const text = entry.mode === "spans" ? entry.gloss : entry.text;
  const lines = String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (entry.note) lines.push(entry.note);
  if (!lines.length) return { tag: "div", content: "--" };

  const content = [];
  lines.forEach((line, i) => {
    if (i) content.push({ tag: "br" });
    content.push(line);
  });
  return { tag: "div", content };
}

/** Render one entry as Yomitan structured-content.
 *
 *  `source` names the dictionary the entry came from. The per-dialect builds
 *  leave it empty (the dictionary heading already says it); the combined
 *  edition passes the dialect name so the origin survives the merge. */
export function buildDefinition(entry, source = "") {
  const { headword, reading, kanji = "", pos = [], region = [], url } = entry;

  // The <span class=ve> reading carries the pitch accent as ・; keep it out of
  // the displayed headword ("あいてくさ・い" -> "あいてくさい").
  const display = cleanReading(reading) || headword;
  const header = [bold(display)];
  if (kanji) header.push({ tag: "span", content: `【${kanji}】` });
  if (pos.length) header.push({ tag: "span", content: ` [${pos.join("・")}]` });
  if (region.length) header.push({ tag: "span", content: ` 〈${region.join("・")}〉` });
  if (source) header.push({ tag: "span", content: ` 〔${source}〕` });
  header.push({ tag: "a", content: "詳細", href: url });

  return [
    {
      type: "structured-content",
      content: [
        { tag: "span", content: header, data: { name: "header" } },
        renderBody(entry),
      ],
    },
  ];
}

/** Minimal 64x64 PNG icon: light background with a centred blue square. */
export function makeIcon(size = 64) {
  const bg = [245, 247, 250];
  const fg = [52, 120, 200];
  const pad = Math.floor(size / 5);
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const c = pad <= x && x < size - pad && pad <= y && y < size - pad ? fg : bg;
      raw[o++] = c[0];
      raw[o++] = c[1];
      raw[o++] = c[2];
    }
  }

  const chunk = (type, payload) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(payload.length, 0);
    const body = Buffer.concat([Buffer.from(type, "ascii"), payload]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// --- build ----------------------------------------------------------------

export function buildDictionary(dict) {
  const { slug } = dict;
  const rawPath = join(ROOT, "data", `${slug}.json`);
  if (!existsSync(rawPath)) return null;

  const raw = JSON.parse(readFileSync(rawPath, "utf8"));
  const revision = raw.revision || new Date().toISOString().slice(0, 10);
  const rows = raw.entries || [];

  const merged = mergeForms(rows);

  // One term per written form (kana headword, heading variants and every kanji
  // spelling), so a lookup resolves whichever spelling the reader sees.
  const terms = [];
  const seen = new Set();
  merged.forEach((entry, idx) => {
    const reading = entryReading(entry);
    const definition = buildDefinition(entry);
    const add = (expression) => {
      const expr = String(expression || "").trim();
      if (!expr) return;
      const key = `${expr}\u0000${reading}\u0000${idx}`;
      if (seen.has(key)) return;
      seen.add(key);
      terms.push([expr, reading, "", "", 0, definition, 0, ""]);
    };
    add(entry.headword);
    if (usableLabel(entry.label)) add(entry.label);
    for (const l of entry.labels || []) if (usableLabel(l)) add(l);
    for (const v of entry.variants || []) add(v);
    for (const k of kanjiVariants(entry.kanji)) add(k);
  });

  const zipName = `weblio-${slug}-dialect-yomitan.zip`;
  const tag = slug; // one release tag per dictionary
  const base = `https://github.com/${REPO}/releases/download/${tag}`;

  const index = {
    title: dict.title,
    revision,
    format: 3,
    author: dict.author,
    url: raw.source || `https://www.weblio.jp/cat/dialect/${slug}`,
    description: dict.description,
    isUpdatable: true,
    indexUrl: `${base}/index.json`,
    downloadUrl: `${base}/${zipName}`,
  };

  const indexJson = JSON.stringify(index, null, 2);
  const termBankJson = JSON.stringify(terms);

  const outDir = join(ROOT, "dist", slug);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.json"), indexJson);
  writeFileSync(join(outDir, "term_bank_1.json"), termBankJson);

  // Timestamp the archive from the revision date for reproducible builds.
  const zip = makeZip(
    [
      { name: "index.json", data: indexJson },
      { name: "term_bank_1.json", data: termBankJson },
      { name: "icon.png", data: makeIcon() },
    ],
    { date: `${revision}T00:00:00Z` },
  );
  writeFileSync(join(outDir, zipName), zip);

  // A friendlier copy for handing the dictionary to a person: the name mirrors
  // the community convention "[JA-JA Dialect] <dictionary>".
  const friendly = join(ROOT, "output", `[JA-JA Dialect] ${dict.title}.zip`);
  mkdirSync(join(ROOT, "output"), { recursive: true });
  writeFileSync(friendly, zip);

  return { slug, entries: rows.length, merged: merged.length, terms: terms.length, zip, zipName, revision };
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const slugArg = process.argv.find((a) => a.startsWith("--slug="));
  const all = JSON.parse(readFileSync(join(ROOT, "dictionaries.json"), "utf8"));
  const targets = slugArg ? all.filter((d) => d.slug === slugArg.split("=")[1]) : all;

  let totalEntries = 0;
  let totalTerms = 0;
  const rows = [];
  for (const dict of targets) {
    const r = buildDictionary(dict);
    if (!r) {
      console.log(`${dict.slug.padEnd(8)} (no snapshot)`);
      continue;
    }
    totalEntries += r.entries;
    totalTerms += r.terms;
    rows.push(r);
    console.log(
      `${r.slug.padEnd(8)} ${String(r.entries).padStart(6)} entries -> ` +
        `${String(r.merged).padStart(5)} words -> ${String(r.terms).padStart(6)} terms  ` +
        `${(r.zip.length / 1024).toFixed(0)} KiB  rev ${r.revision}`,
    );
  }
  console.log(`\nTOTAL ${totalEntries} entries, ${totalTerms} terms, ${rows.length} dictionaries`);
}
