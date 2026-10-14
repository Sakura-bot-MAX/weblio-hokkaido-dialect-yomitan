// Sanity-check the built dictionaries: how many entries each one has, how many
// came out empty, and which body shape they used.
//
//   node src/validate.mjs

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dicts = JSON.parse(readFileSync(join(ROOT, "dictionaries.json"), "utf8"));

let grand = 0;
const problems = [];

console.log(
  "slug     entries  words  terms  empty  modes                          zip",
);
for (const d of dicts) {
  const rawPath = join(ROOT, "data", `${d.slug}.json`);
  const indexPath = join(ROOT, "dist", d.slug, "index.json");
  if (!existsSync(rawPath)) {
    console.log(`${d.slug.padEnd(8)} (no snapshot)`);
    continue;
  }
  const raw = JSON.parse(readFileSync(rawPath, "utf8"));
  const entries = raw.entries || [];

  const modes = {};
  let empty = 0;
  for (const e of entries) {
    modes[e.mode] = (modes[e.mode] || 0) + 1;
    const hasBody =
      (e.mode === "table" && e.rows && e.rows.length) ||
      (e.mode === "spans" && e.gloss) ||
      (e.mode === "text" && e.text);
    if (!hasBody) {
      empty++;
      if (problems.length < 25) problems.push(`${d.slug}: ${e.headword} ${e.url}`);
    }
  }

  let words = 0;
  let terms = 0;
  let zipKb = 0;
  if (existsSync(indexPath)) {
    const tb = JSON.parse(readFileSync(join(ROOT, "dist", d.slug, "term_bank_1.json"), "utf8"));
    terms = tb.length;
    words = new Set(tb.map((t) => t[1])).size;
    const zp = join(ROOT, "dist", d.slug, `weblio-${d.slug}-dialect-yomitan.zip`);
    zipKb = existsSync(zp) ? Math.round(readFileSync(zp).length / 1024) : 0;
  }

  grand += entries.length;
  console.log(
    `${d.slug.padEnd(8)} ${String(entries.length).padStart(6)} ${String(words).padStart(6)} ` +
      `${String(terms).padStart(6)} ${String(empty).padStart(6)}  ` +
      `${JSON.stringify(modes).padEnd(28)} ${zipKb} KiB`,
  );
}

console.log(`\nTOTAL ${grand} entries`);
if (problems.length) {
  console.log(`\nentries without a definition (${problems.length}):`);
  for (const p of problems) console.log("  " + p);
}
