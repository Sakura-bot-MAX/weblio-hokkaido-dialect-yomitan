// Write output/README.md: a catalogue of every built dialect dictionary.
//
// Also injects the catalogue table into the root README.md between the
// <!-- DICT-TABLE-START --> / <!-- DICT-TABLE-END --> markers, so the table
// cannot drift from the snapshots.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

// --- output/README.md -------------------------------------------------------

const out = [];
out.push("# Weblio Dialect Dictionaries — Yomitan edition (all 23)");
out.push("");
out.push("Source: <https://www.weblio.jp/cat/dialect> | Format: Yomitan / Yomichan (format 3)");
out.push("");
out.push("| # | Dictionary | Region | Headwords | Lookup terms | Snapshot |");
out.push("|---|---|---|---|---|---|");
rows.forEach((r, i) => {
  out.push(`| ${i + 1} | ${r.name} (${r.nameEn}) | ${r.regionEn} | ${fmt(r.entries)} | ${fmt(r.terms)} | ${r.rev} |`);
});
out.push("");
out.push(`Total: 23 dictionaries, ${fmt(totalEntries)} headwords, ${fmt(totalTerms)} lookup terms.`);
out.push("");
out.push("## Install (Yomitan / Yomichan)");
out.push("");
out.push("1. Open Yomitan settings → Dictionaries → Import");
out.push("2. Pick any `[JA-JA Dialect] Weblio….zip` from this folder (you can select several at once)");
out.push("3. Wait for the index to finish, then look words up");
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
