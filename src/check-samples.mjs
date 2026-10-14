// Offline check: run the generic parser over the saved sample pages and show
// what it extracts, so every dictionary layout can be eyeballed at once.
//
//   node src/check-samples.mjs [probeDir]

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parsePage } from "./lib/parse.mjs";

const dir = process.argv[2] || "../../_probe/samples";
const files = readdirSync(dir).filter((f) => f.endsWith(".html") && !f.startsWith("idx_"));

const bySlug = new Map();
for (const f of files) {
  const slug = f.split("__")[0];
  if (!bySlug.has(slug)) bySlug.set(slug, []);
  bySlug.get(slug).push(f);
}

for (const [slug, fs] of [...bySlug].sort()) {
  console.log("=".repeat(70));
  console.log("###", slug);
  for (const f of fs) {
    const html = readFileSync(join(dir, f), "utf8");
    const entries = parsePage(html);
    if (!entries.length) {
      console.log(`  [${f}] no entry (len=${html.length})`);
      continue;
    }
    for (const e of entries) {
      const g = e.mode === "table"
        ? e.rows.map((r) => r.join(" | ")).join(" ⏎ ")
        : e.mode === "spans"
          ? `${e.gloss}`
          : e.text.replace(/\n/g, " ⏎ ");
      console.log(
        `  [${f.slice(0, 34)}] mode=${e.mode} head="${e.headword}" read="${e.reading}" ` +
          `kanji="${e.kanji}" pos=${JSON.stringify(e.pos)} gnr=${JSON.stringify(e.region)} var=${JSON.stringify(e.variants)}`,
      );
      console.log(`      gloss: ${g.slice(0, 260)}`);
    }
  }
}
