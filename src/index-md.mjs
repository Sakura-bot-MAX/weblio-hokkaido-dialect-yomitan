// Write output/README.md: a catalogue of every built dialect dictionary.
//
// Also injects the catalogue table into the root README.md between the
// <!-- DICT-TABLE-START --> / <!-- DICT-TABLE-END --> markers, so the table
// cannot drift from the snapshots.
//
// The combined edition (dist/all/) is described from its own build output, so
// its size and term count in the READMEs stay honest too.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MERGED, zipNameFor } from "./merged.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const dicts = JSON.parse(readFileSync(join(ROOT, "dictionaries.json"), "utf8"));

const rows = [];
let totalEntries = 0;
let totalTerms = 0;
for (const d of dicts) {
  const tb = JSON.parse(readFileSync(join(ROOT, "dist", d.slug, "term_bank_1.json"), "utf8"));
  const raw = JSON.parse(readFileSync(join(ROOT, "data", `${d.slug}.json`), "utf8"));
  totalEntries += raw.count;
  totalTerms += tb.length;
  rows.push({
    slug: d.slug,
    name: d.name,
    nameEn: d.nameEn,
    regionEn: d.regionEn,
    title: d.title,
    entries: raw.count,
    terms: tb.length,
    rev: raw.revision,
  });
}
rows.sort((a, b) => b.terms - a.terms);

const zipLink = (r) => `[zip](output/${encodeURI(`[JA-JA Dialect] ${r.title}.zip`)})`;
const fmt = (n) => n.toLocaleString("en-US");

// --- combined edition stats -------------------------------------------------

const mergedFile = `[JA-JA Dialect] ${MERGED.title}.zip`;
const mergedDir = join(ROOT, "dist", MERGED.slug);
const merged = { built: false };
if (existsSync(join(mergedDir, "term_bank_1.json"))) {
  const tb = JSON.parse(readFileSync(join(mergedDir, "term_bank_1.json"), "utf8"));
  const index = JSON.parse(readFileSync(join(mergedDir, "index.json"), "utf8"));
  const zipPath = join(mergedDir, zipNameFor(MERGED.slug));
  merged.built = true;
  merged.terms = tb.length;
  merged.rev = index.revision;
  merged.kb = existsSync(zipPath) ? Math.round(readFileSync(zipPath).length / 1024) : 0;
  merged.sources = new Set(tb.map((t) => t[2].split(",")[0])).size;
  merged.link = `[zip](output/${encodeURI(mergedFile)})`;
}
const mergedNote = merged.built
  ? `${merged.link} — all ${fmt(merged.terms)} lookup terms in a single dictionary ` +
    `(${fmt(merged.sources)} source dictionaries, ${merged.kb} KiB, snapshot ${merged.rev}). ` +
    `Every entry is tagged with the Japanese name of the dialect it came from.`
  : "not built yet (`node src/build-merged.mjs`).";

// --- output/README.md -------------------------------------------------------

const out = [];
out.push("# Weblio Dialect Dictionaries — Yomitan edition (all 23)");
out.push("");
out.push("Source: <https://www.weblio.jp/cat/dialect> | Format: Yomitan / Yomichan (format 3)");
out.push("");
out.push("Two editions are shipped from the same data:");
out.push("");
out.push("| Edition | Files | Use it when |");
out.push("|---|---|---|");
out.push(
  `| Per dialect | 23 zips, one per dictionary | you want one region, or want to switch dialects on and off separately |`,
);
out.push(
  `| Combined | \`${mergedFile}\` | you want the whole dialect corpus in a single dictionary slot |`,
);
out.push("");
out.push("## Per-dialect editions");
out.push("");
out.push("| # | Dictionary | Region | Headwords | Lookup terms | Snapshot |");
out.push("|---|---|---|---|---|---|");
rows.forEach((r, i) => {
  out.push(`| ${i + 1} | ${r.name} (${r.nameEn}) | ${r.regionEn} | ${fmt(r.entries)} | ${fmt(r.terms)} | ${r.rev} |`);
});
out.push("");
out.push(`Total: 23 dictionaries, ${fmt(totalEntries)} headwords, ${fmt(totalTerms)} lookup terms.`);
out.push("");
out.push("## Combined edition");
out.push("");
out.push(mergedNote);
out.push("");
if (merged.built) {
  out.push(
    `The combined zip holds the same ${fmt(merged.terms)} lookup terms as the 23 separate builds, ` +
      `so nothing is lost or duplicated — the same entries in one file, each tagged with the ` +
      `Japanese name of its source dictionary, which is also what Yomitan's tag filter uses to ` +
      `narrow the dictionary down to a single dialect.`,
  );
  out.push("");
}
out.push("## Install (Yomitan / Yomichan)");
out.push("");
out.push("1. Open Yomitan settings → Dictionaries → Import");
out.push("2. Pick either edition: any `[JA-JA Dialect] Weblio….zip` from this folder (you can select several at once)");
out.push("3. Wait for the index to finish, then look words up");
out.push("");
out.push("Installing both editions at once is not useful — the combined one already contains everything,");
out.push("and Yomitan would show each word twice.");
out.push("");
out.push("Each zip contains `index.json`, `term_bank_1.json` and `icon.png`, and declares");
out.push("`isUpdatable` so Yomitan can update it in place once it is published to a GitHub release.");
out.push("");

writeFileSync(join(ROOT, "output", "README.md"), out.join("\n"));
console.log(out.join("\n"));

// --- root README table injection -------------------------------------------

const START = "<!-- DICT-TABLE-START -->";
const END = "<!-- DICT-TABLE-END -->";

const README = join(ROOT, "README.md");
if (!existsSync(README)) {
  console.warn("README.md: not found, table not injected");
} else {
  const lines = [
    "| # | Dictionary | Region | Headwords | Lookup terms | Snapshot | Download |",
    "|---|---|---|---|---|---|---|",
  ];
  rows.forEach((r, i) => {
    lines.push(`| ${i + 1} | ${r.name} (${r.nameEn}) | ${r.regionEn} | ${fmt(r.entries)} | ${fmt(r.terms)} | ${r.rev} | ${zipLink(r)} |`);
  });
  lines.push("");
  lines.push(`**23 dictionaries / ${fmt(totalEntries)} headwords / ${fmt(totalTerms)} lookup terms** in total.`);
  lines.push("");
  lines.push(`**Combined edition:** ${mergedNote}`);
  const table = lines.join("\n");

  const src = readFileSync(README, "utf8");
  const a = src.indexOf(START);
  const b = src.indexOf(END);
  if (a === -1 || b === -1 || b <= a) {
    console.warn("README.md: markers not found, table not injected");
  } else {
    const next = src.slice(0, a + START.length) + "\n" + table + "\n" + src.slice(b);
    if (next !== src) {
      writeFileSync(README, next);
      console.log("README.md: catalogue table updated");
    } else {
      console.log("README.md: catalogue table unchanged");
    }
  }
}
