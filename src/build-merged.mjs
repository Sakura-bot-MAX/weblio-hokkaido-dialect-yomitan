// Build the combined edition: dist/all/.
//
//   node src/build-merged.mjs
//
// Every term from all twenty-three snapshots lands in a single term_bank, each
// tagged with the dictionary it came from. The per-dialect builds are left
// untouched, so the twenty-three releases already online keep their bytes.
//
// The archive is timestamped from the newest snapshot revision and the entries
// are emitted in dictionaries.json order, so rebuilding an unchanged snapshot
// set produces a byte-identical zip.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeZip } from "./zip.mjs";
import { MERGED, zipNameFor } from "./merged.mjs";
import {
  REPO,
  buildDefinition,
  entryReading,
  kanjiVariants,
  makeIcon,
  mergeForms,
  usableLabel,
} from "./build.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Assemble one term_bank out of every per-dialect snapshot.
 * @param {{slug: string, name: string, regionEn?: string}[]} dicts
 */
export function buildMerged(dicts) {
  const terms = [];
  const sources = [];
  let revision = "";

  for (const dict of dicts) {
    const rawPath = join(ROOT, "data", `${dict.slug}.json`);
    if (!existsSync(rawPath)) {
      sources.push({ slug: dict.slug, name: dict.name, words: 0, terms: 0, revision: "" });
      continue;
    }
    const raw = JSON.parse(readFileSync(rawPath, "utf8"));
    const rev = raw.revision || "";
    if (rev > revision) revision = rev;

    // Two tags per entry: the dictionary it came from and its region, so
    // Yomitan's tag filter can narrow the combined dictionary down to either.
    const tags = [dict.name, dict.regionEn].filter(Boolean).join(",");

    const merged = mergeForms(raw.entries || []);
    let count = 0;
    for (const entry of merged) {
      const reading = entryReading(entry);
      const definition = buildDefinition(entry, dict.name);
      const seen = new Set();
      const add = (expression) => {
        const expr = String(expression || "").trim();
        if (!expr || seen.has(expr)) return;
        seen.add(expr);
        terms.push([expr, reading, tags, "", 0, definition, 0, ""]);
        count++;
      };
      add(entry.headword);
      if (usableLabel(entry.label)) add(entry.label);
      for (const l of entry.labels || []) if (usableLabel(l)) add(l);
      for (const v of entry.variants || []) add(v);
      for (const k of kanjiVariants(entry.kanji)) add(k);
    }

    sources.push({ slug: dict.slug, name: dict.name, words: merged.length, terms: count, revision: rev });
  }

  if (!revision) revision = new Date().toISOString().slice(0, 10);
  return { terms, sources, revision };
}

/** Write dist/all/ and the friendly copy under output/. */
export function writeMerged({ terms, sources, revision }) {
  const slug = MERGED.slug;
  const zipName = zipNameFor(slug);
  const base = `https://github.com/${REPO}/releases/download/${slug}`;

  const index = {
    title: MERGED.title,
    revision,
    format: 3,
    author: MERGED.author,
    url: MERGED.url,
    description: MERGED.description,
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

  const zip = makeZip(
    [
      { name: "index.json", data: indexJson },
      { name: "term_bank_1.json", data: termBankJson },
      { name: "icon.png", data: makeIcon() },
    ],
    { date: `${revision}T00:00:00Z` },
  );
  writeFileSync(join(outDir, zipName), zip);

  const friendly = join(ROOT, "output", `[JA-JA Dialect] ${MERGED.title}.zip`);
  mkdirSync(join(ROOT, "output"), { recursive: true });
  writeFileSync(friendly, zip);

  return { zip, zipName, indexJson, revision, sources, terms };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const dicts = JSON.parse(readFileSync(join(ROOT, "dictionaries.json"), "utf8"));
  const built = buildMerged(dicts);
  const r = writeMerged(built);

  for (const s of r.sources) {
    console.log(
      `${s.slug.padEnd(8)} ${String(s.words).padStart(5)} words -> ${String(s.terms).padStart(6)} terms  rev ${s.revision}`,
    );
  }
  console.log(
    `\n${MERGED.slug.padEnd(8)} ${String(r.sources.reduce((a, s) => a + s.words, 0)).padStart(5)} words -> ` +
      `${String(r.terms.length).padStart(6)} terms  ${(r.zip.length / 1024).toFixed(0)} KiB  rev ${r.revision}`,
  );
  console.log(`wrote dist/${MERGED.slug}/ (${r.zipName}) and output/[JA-JA Dialect] ${MERGED.title}.zip`);
}
