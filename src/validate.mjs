// Sanity-check the built dictionaries: how many entries each one has, how many
// came out empty, and which body shape they used.
//
//   node src/validate.mjs
//
// The combined edition (dist/all/) is checked afterwards: its term count must
// equal the sum of the per-dialect builds, otherwise the merge dropped or
// duplicated something.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MERGED, zipNameFor } from "./merged.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dicts = JSON.parse(readFileSync(join(ROOT, "dictionaries.json"), "utf8"));

let grand = 0;
let grandTerms = 0;
const problems = [];
const perDialect = [];

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
    perDialect.push({ slug: d.slug, tb });
  }

  grand += entries.length;
  grandTerms += terms;
  console.log(
    `${d.slug.padEnd(8)} ${String(entries.length).padStart(6)} ${String(words).padStart(6)} ` +
      `${String(terms).padStart(6)} ${String(empty).padStart(6)}  ` +
      `${JSON.stringify(modes).padEnd(28)} ${zipKb} KiB`,
  );
}

console.log(`\nTOTAL ${grand} entries, ${grandTerms} terms in ${dicts.length} dictionaries`);

// --- combined edition -------------------------------------------------------

const mergedDir = join(ROOT, "dist", MERGED.slug);
const mergedIndexPath = join(mergedDir, "index.json");
if (!existsSync(mergedIndexPath)) {
  console.log(`\n${MERGED.slug}: not built (run node src/build-merged.mjs)`);
} else {
  const index = JSON.parse(readFileSync(mergedIndexPath, "utf8"));
  const tb = JSON.parse(readFileSync(join(mergedDir, "term_bank_1.json"), "utf8"));
  const zipPath = join(mergedDir, zipNameFor(MERGED.slug));
  const zipKb = existsSync(zipPath) ? Math.round(readFileSync(zipPath).length / 1024) : 0;
  const sources = new Set(tb.map((t) => t[2]));
  const untagged = tb.filter((t) => !t[2]).length;

  console.log(
    `\n${MERGED.slug.padEnd(8)} ${String(tb.length).padStart(6)} terms  ` +
      `${String(sources.size).padStart(3)} source dictionaries  ${zipKb} KiB  rev ${index.revision}`,
  );

  // The merge must not touch a definition: the combined edition is the same
  // entries in one file, told apart by their tag and nothing else. Walk the
  // per-dialect builds in the same order and compare term for term.
  let drifted = 0;
  let cursor = 0;
  for (const { tb: one } of perDialect) {
    const slice = tb.slice(cursor, cursor + one.length);
    for (let i = 0; i < one.length; i++) {
      if (!slice[i] || JSON.stringify(slice[i][5]) !== JSON.stringify(one[i][5])) drifted++;
    }
    cursor += one.length;
  }

  const checks = [];
  if (tb.length !== grandTerms) {
    checks.push(`term count ${tb.length} != sum of per-dialect builds ${grandTerms}`);
  }
  if (sources.size !== dicts.length) {
    checks.push(`only ${sources.size} of ${dicts.length} dictionaries are represented`);
  }
  if (untagged) checks.push(`${untagged} terms carry no source tag`);
  if (drifted) checks.push(`${drifted} definitions differ from the per-dialect builds`);
  if (index.format !== 3) checks.push(`format is ${index.format}, expected 3`);
  if (!index.isUpdatable || !index.indexUrl || !index.downloadUrl) {
    checks.push("index.json is missing the self-update fields");
  }
  if (checks.length) {
    console.log("  PROBLEMS:");
    for (const c of checks) console.log(`    - ${c}`);
  } else {
    console.log("  ok: same terms and same definitions as the per-dialect builds");
  }
}

if (problems.length) {
  console.log(`\nentries without a definition (${problems.length}):`);
  for (const p of problems) console.log("  " + p);
}
