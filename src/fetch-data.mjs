// Crawl every Weblio dialect dictionary listed in dictionaries.json and
// snapshot each one into data/<slug>.json.
//
//   node src/fetch-data.mjs                    # crawl everything
//   node src/fetch-data.mjs --slug=osaka       # one dictionary
//   node src/fetch-data.mjs --slug=osaka --limit=50
//   node src/fetch-data.mjs --offline          # just report the snapshots
//
// Raw pages are cached under cache/<slug>/<sha1>.html so an interrupted or
// repeated run never re-fetches a page it already has. Entries are sorted
// before they are written, so the git diff of data/<slug>.json reflects real
// upstream changes rather than crawl order.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parsePage } from "./lib/parse.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "cache");
const DATA = join(ROOT, "data");

const ORIGIN = "https://www.weblio.jp";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const INDEX_PAUSE = 250; // ms between index-page requests
const ENTRY_PAUSE = 220; // ms between entry-page requests
const MAX_INDEX_PAGES = 220; // hard stop against pagination loops

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- fetching (with on-disk cache) ---------------------------------------

function cachePath(slug, url) {
  const h = createHash("sha1").update(url).digest("hex");
  return join(CACHE, slug, `${h}.html`);
}

const isCached = (slug, url) => {
  const p = cachePath(slug, url);
  return existsSync(p) && readFileSync(p, "utf8").length > 200;
};

async function fetchText(slug, url, { retries = 5 } = {}) {
  const path = cachePath(slug, url);
  if (isCached(slug, url)) return readFileSync(path, "utf8");

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          "Accept-Language": "ja,en;q=0.8",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      if (res.status === 404) return "";
      if (res.status === 429 || res.status === 503) {
        const wait = 5000 * (attempt + 1) ** 1.5;
        console.error(`  ${res.status} on ${url}; waiting ${Math.round(wait / 1000)}s`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      mkdirSync(join(CACHE, slug), { recursive: true });
      writeFileSync(path, text);
      return text;
    } catch (err) {
      if (attempt === retries) {
        console.error(`  giving up on ${url}: ${err.message}`);
        return "";
      }
      await sleep(1500 * (attempt + 1));
    }
  }
  return "";
}

// --- index discovery ------------------------------------------------------

const ENTRY_HREF = (code) =>
  new RegExp(
    `href="(${ORIGIN}/content/[^"?]+\\?dictCode=${code})"[^>]*>([^<]*)</a>`,
    "g",
  );

/**
 * BFS the index pages of one dictionary and return every entry URL.
 *
 * Two index layouts exist upstream:
 *   (a) /cat/dialect/<slug>      -> links to kana sub-index pages
 *       /category/dialect/<slug>/<kana>[/<page>] -> the entry links
 *   (b) /category/dialect/<slug> -> the whole index (class=crosslink) inline
 * Seeding both roots and following the kana sub-index links covers either one.
 */
async function discoverEntries(slug, code, { limit = 0 } = {}) {
  const roots = [
    `${ORIGIN}/cat/dialect/${slug}`,
    `${ORIGIN}/category/dialect/${slug}`,
  ];
  const subRe = new RegExp(
    `href="(${ORIGIN}/category/dialect/${slug}/([a-z]{1,6}(?:/\\d{1,2})?))"`,
    "g",
  );

  const queue = [...roots];
  const seenPages = new Set();
  const entries = new Map(); // url -> label

  while (queue.length && seenPages.size < MAX_INDEX_PAGES) {
    const url = queue.shift();
    if (seenPages.has(url)) continue;
    seenPages.add(url);

    const html = await fetchText(slug, url);
    if (!html) continue;

    for (const m of html.matchAll(ENTRY_HREF(code))) {
      if (!entries.has(m[1])) entries.set(m[1], m[2].trim());
    }
    for (const m of html.matchAll(subRe)) {
      const next = m[1];
      if (!seenPages.has(next) && !queue.includes(next)) queue.push(next);
    }
    if (!isCached(slug, url)) await sleep(INDEX_PAUSE);
  }

  console.log(
    `  index: ${seenPages.size} pages -> ${entries.size} entry links`,
  );
  const list = [...entries].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return limit > 0 ? list.slice(0, limit) : list;
}

// --- per-dictionary crawl -------------------------------------------------

async function crawlDictionary(dict, { limit = 0 } = {}) {
  const { slug, code } = dict;
  console.log(`\n=== ${slug} (${code}) ${dict.name}`);
  const links = await discoverEntries(slug, code, { limit });
  if (!links.length) {
    console.log("  no entry links found");
    return null;
  }

  const entries = [];
  let done = 0;
  let empty = 0;
  for (const [url, label] of links) {
    const html = await fetchText(slug, url);
    if (html) {
      const parsed = parsePage(html, { label });
      if (parsed.length) {
        for (const p of parsed) entries.push({ ...p, url, label });
      } else {
        empty++;
      }
    } else {
      empty++;
    }
    if (++done % 200 === 0) console.log(`  ...${done}/${links.length} (empty ${empty})`);
    if (!isCached(slug, url)) await sleep(ENTRY_PAUSE);
  }
  console.log(`  parsed ${entries.length} entries (${empty} pages without an entry)`);

  // Deterministic order: by source URL, then by heading.
  entries.sort((a, b) =>
    a.url < b.url ? -1 : a.url > b.url ? 1 : a.headword < b.headword ? -1 : 1,
  );
  return entries;
}

// --- revision handling ----------------------------------------------------

function writeSnapshot(slug, entries, sourceUrl, { dryRun = false } = {}) {
  const path = join(DATA, `${slug}.json`);
  const today = new Date().toISOString().slice(0, 10);

  let revision = today;
  if (existsSync(path)) {
    const prev = JSON.parse(readFileSync(path, "utf8"));
    if (JSON.stringify(prev.entries) === JSON.stringify(entries)) {
      revision = prev.revision;
      console.log(`  upstream unchanged; keeping revision ${revision}`);
    } else {
      console.log(`  upstream changed; revision ${prev.revision} -> ${today}`);
    }
  }

  const snapshot = { slug, revision, source: sourceUrl, count: entries.length, entries };
  if (dryRun) {
    console.log(`  --limit: not writing data/${slug}.json`);
    console.log("  first entry:", JSON.stringify(entries[0] ?? {}, null, 1));
    return snapshot;
  }
  mkdirSync(DATA, { recursive: true });
  writeFileSync(path, JSON.stringify(snapshot, null, 1) + "\n");
  console.log(`  wrote data/${slug}.json (${entries.length} entries, rev ${revision})`);
  return snapshot;
}

// --- main -----------------------------------------------------------------

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

const DICTS = JSON.parse(readFileSync(join(ROOT, "dictionaries.json"), "utf8"));

if (isMain && process.argv.includes("--offline")) {
  for (const d of DICTS) {
    const p = join(DATA, `${d.slug}.json`);
    if (existsSync(p)) {
      const s = JSON.parse(readFileSync(p, "utf8"));
      console.log(`${d.slug.padEnd(8)} ${String(s.count).padStart(6)} entries  rev ${s.revision}`);
    } else {
      console.log(`${d.slug.padEnd(8)} (no snapshot)`);
    }
  }
} else if (isMain) {
  const slugArg = process.argv.find((a) => a.startsWith("--slug="));
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;
  const targets = slugArg
    ? DICTS.filter((d) => d.slug === slugArg.split("=")[1])
    : DICTS;

  const summary = [];
  for (const dict of targets) {
    let entries = null;
    try {
      entries = await crawlDictionary(dict, { limit });
    } catch (err) {
      console.error(`  ${dict.slug} failed: ${err.stack || err.message}`);
      continue;
    }
    if (!entries) continue;
    writeSnapshot(dict.slug, entries, `${ORIGIN}/cat/dialect/${dict.slug}`, {
      dryRun: limit > 0,
    });
    summary.push([dict.slug, entries.length]);
  }
  console.log("\n--- summary ---");
  for (const [slug, n] of summary) console.log(`${slug.padEnd(8)} ${n}`);
  console.log(`TOTAL ${summary.reduce((a, [, n]) => a + n, 0)}`);
}
