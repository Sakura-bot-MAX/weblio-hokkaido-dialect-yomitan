// Build the Yomitan (format 3) dictionary from data/raw.json.
//
//   node src/build.mjs
//
// Writes dist/index.json, dist/term_bank_1.json and the packaged zip. The zip
// timestamp is derived from the revision date so identical content produces a
// byte-identical archive, which lets CI tell whether a rebuild changed anything.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { makeZip } from "./zip.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// GitHub repository that hosts the releases, as "owner/name". CI passes the
// actual repo via YOMITAN_REPO (see .github/workflows/update.yml), so forks
// get correct self-update URLs without editing this file.
const REPO =
  process.env.YOMITAN_REPO ||
  process.env.GITHUB_REPOSITORY ||
  "Sakura-bot-MAX/weblio-hokkaido-dialect-yomitan";

const TITLE = "Weblio北海道方言";
const DESCRIPTION =
  "北海道方言辞書（Weblio）の全項目を収録した方言辞典です。";
const AUTHOR = process.env.YOMITAN_AUTHOR || "Weblio 北海道方言辞書";
const UPSTREAM_URL = "https://www.weblio.jp/cat/dialect/hkdhj";
const ZIP_NAME = "weblio-hokkaido-dialect-yomitan.zip";

// --- helpers --------------------------------------------------------------

/** Split a 漢字表記 field into searchable spellings, expanding okurigana
 *  parentheses: '骨付(き)ざんぎ・骨附(き)ざんぎ' ->
 *  ['骨付ざんぎ','骨付きざんぎ','骨附ざんぎ','骨附きざんぎ'] */
function kanjiVariants(field) {
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
 *  single entry, unioning all of its kanji spellings. */
function mergeForms(rows) {
  const groups = new Map();
  for (const x of rows) {
    if (!x.headword) continue;
    const reading = x.reading || x.headword;
    const key = JSON.stringify([reading, x.pos || [], x.gloss || ""]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(x);
  }

  const merged = [];
  for (const items of groups.values()) {
    const primary = { ...items[0] };
    const kanji = [];
    for (const item of items) {
      for (const k of kanjiVariants(item.kanji)) {
        if (k && !kanji.includes(k)) kanji.push(k);
      }
    }
    if (kanji.length) primary.kanji = kanji.join("・");
    merged.push(primary);
  }
  return merged;
}

/** Strip pitch-accent notation so the reading stays a clean search key. */
function cleanReading(s) {
  return String(s || "")
    .replace(/[・△]/g, "")
    .replace(/[〈（(\[][^〉）)\]]*[〉）)\]]/g, "")
    .trim();
}

const bold = (content) => ({ tag: "span", content, style: { fontWeight: "bold" } });
const td = (content) => ({ tag: "td", content });
const th = (content) => ({ tag: "th", content, style: { textAlign: "left" } });

/** Render one entry as Yomitan structured-content. */
function buildDefinition(entry) {
  const { headword, reading, kanji = "", pos = [], region = [], gloss, url } = entry;

  const header = [bold(reading || headword)];
  if (kanji) header.push({ tag: "span", content: `【${kanji}】` });
  if (pos.length) header.push({ tag: "span", content: ` [${pos.join("・")}]` });
  if (region.length) header.push({ tag: "span", content: ` 〈${region.join("・")}〉` });
  header.push({ tag: "a", content: "詳細", href: url });

  return [
    {
      type: "structured-content",
      content: [
        { tag: "span", content: header, data: { name: "header" } },
        {
          tag: "table",
          content: {
            tag: "tbody",
            content: [
              { tag: "tr", content: [th("北海道方言"), th("漢字表記"), th("解説")] },
              {
                tag: "tr",
                content: [td(headword), td(kanji || "--"), td((gloss || "").trim() || "--")],
              },
            ],
          },
        },
      ],
    },
  ];
}

/** Minimal 64x64 PNG icon: light background with a centred blue square. */
function makeIcon(size = 64) {
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

// Small local CRC-32 (kept here so makeIcon stays self-contained).
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

const raw = JSON.parse(readFileSync(join(ROOT, "data", "raw.json"), "utf8"));
const revision = raw.revision || new Date().toISOString().slice(0, 10);
const rows = raw.entries || [];

const merged = mergeForms(rows);
console.log(`merge forms: ${rows.length} -> ${merged.length}`);

// One term per written form (kana headword plus every kanji spelling), so a
// lookup resolves whether the reader sees the word in kana or in kanji.
const terms = [];
const seen = new Set();
for (const entry of merged) {
  const reading = cleanReading(entry.reading);
  const definition = buildDefinition(entry);
  const add = (expression) => {
    const key = `${expression}\u0000${reading}\u0000${entry.gloss || ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    terms.push([expression, reading, "", "", 0, definition, 0, ""]);
  };
  add(entry.headword);
  for (const k of kanjiVariants(entry.kanji)) {
    if (k && k !== entry.headword) add(k);
  }
}
console.log(`terms: ${terms.length}`);

const index = {
  title: TITLE,
  revision,
  format: 3,
  author: AUTHOR,
  url: UPSTREAM_URL,
  description: DESCRIPTION,
  isUpdatable: true,
  indexUrl: `https://github.com/${REPO}/releases/latest/download/index.json`,
  downloadUrl: `https://github.com/${REPO}/releases/latest/download/${ZIP_NAME}`,
};

const indexJson = JSON.stringify(index, null, 2);
const termBankJson = JSON.stringify(terms);

mkdirSync(join(ROOT, "dist"), { recursive: true });
writeFileSync(join(ROOT, "dist", "index.json"), indexJson);
writeFileSync(join(ROOT, "dist", "term_bank_1.json"), termBankJson);

// Timestamp the archive from the revision date for reproducible builds.
const zip = makeZip(
  [
    { name: "index.json", data: indexJson },
    { name: "term_bank_1.json", data: termBankJson },
    { name: "icon.png", data: makeIcon() },
  ],
  { date: `${revision}T00:00:00Z` },
);
writeFileSync(join(ROOT, "dist", ZIP_NAME), zip);

console.log(`wrote dist/index.json, dist/term_bank_1.json, dist/${ZIP_NAME} (${zip.length} bytes)`);
