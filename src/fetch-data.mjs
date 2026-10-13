// Crawl the Weblio 北海道方言辞書 and snapshot it into data/raw.json.
//
//   node src/fetch-data.mjs            # crawl the live site
//   node src/fetch-data.mjs --offline  # just report the existing snapshot
//
// The snapshot is committed, so the git diff of data/raw.json *is* the record
// of how the dictionary changes over time.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RAW_PATH = join(ROOT, "data", "raw.json");

const ORIGIN = "https://www.weblio.jp";
const INDEX_URL = `${ORIGIN}/cat/dialect/hkdhj`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, { retries = 4 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          "Accept-Language": "ja,en;q=0.8",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (res.status === 404) return "";
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
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

// --- HTML helpers ---------------------------------------------------------

// Named character references. Kept to the Latin-1 supplement plus the common
// typographic entities, which is what actually shows up in this source.
const NAMED_ENTITIES = {
  lt: "<", gt: ">", quot: '"', apos: "'", amp: "&",
  nbsp: " ", iexcl: "¡", cent: "¢", pound: "£", curren: "¤", yen: "¥",
  brvbar: "¦", sect: "§", uml: "¨", copy: "©", ordf: "ª", laquo: "«",
  not: "¬", shy: "", reg: "®", macr: "¯", deg: "°", plusmn: "±",
  sup2: "²", sup3: "³", acute: "´", micro: "µ", para: "¶", middot: "·",
  cedil: "¸", sup1: "¹", ordm: "º", raquo: "»", frac14: "¼", frac12: "½",
  frac34: "¾", iquest: "¿",
  Agrave: "À", Aacute: "Á", Acirc: "Â", Atilde: "Ã", Auml: "Ä", Aring: "Å",
  AElig: "Æ", Ccedil: "Ç", Egrave: "È", Eacute: "É", Ecirc: "Ê", Euml: "Ë",
  Igrave: "Ì", Iacute: "Í", Icirc: "Î", Iuml: "Ï", ETH: "Ð", Ntilde: "Ñ",
  Ograve: "Ò", Oacute: "Ó", Ocirc: "Ô", Otilde: "Õ", Ouml: "Ö", times: "×",
  Oslash: "Ø", Ugrave: "Ù", Uacute: "Ú", Ucirc: "Û", Uuml: "Ü", Yacute: "Ý",
  THORN: "Þ", szlig: "ß",
  agrave: "à", aacute: "á", acirc: "â", atilde: "ã", auml: "ä", aring: "å",
  aelig: "æ", ccedil: "ç", egrave: "è", eacute: "é", ecirc: "ê", euml: "ë",
  igrave: "ì", iacute: "í", icirc: "î", iuml: "ï", eth: "ð", ntilde: "ñ",
  ograve: "ò", oacute: "ó", ocirc: "ô", otilde: "õ", ouml: "ö", divide: "÷",
  oslash: "ø", ugrave: "ù", uacute: "ú", ucirc: "û", uuml: "ü", yacute: "ý",
  thorn: "þ", yuml: "ÿ",
  OElig: "Œ", oelig: "œ", Scaron: "Š", scaron: "š", Yuml: "Ÿ",
  fnof: "ƒ", circ: "ˆ", tilde: "˜",
  ensp: " ", emsp: " ", thinsp: " ", zwnj: "\u200c", zwj: "\u200d",
  lrm: "\u200e", rlm: "\u200f", ndash: "–", mdash: "—", lsquo: "‘",
  rsquo: "’", sbquo: "‚", ldquo: "“", rdquo: "”", bdquo: "„", dagger: "†",
  Dagger: "‡", bull: "•", hellip: "…", permil: "‰", prime: "′",
  Prime: "″", lsaquo: "‹", rsaquo: "›", oline: "‾", frasl: "⁄",
  euro: "€", trade: "™", larr: "←", uarr: "↑", rarr: "→", darr: "↓",
  harr: "↔", minus: "−", lowast: "∗", infin: "∞", ne: "≠", le: "≤",
  ge: "≥", loz: "◊", spades: "♠", clubs: "♣", hearts: "♥", diams: "♦",
};

const decodeEntities = (s) =>
  s
    // numeric character references, decimal (&#25620;) and hex (&#x6414;)
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(Number(d)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) => safeCodePoint(parseInt(h, 16)))
    // named references
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name)
        ? NAMED_ENTITIES[name]
        : m,
    );

function safeCodePoint(code) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function stripTags(s) {
  return decodeEntities(
    s.replace(/<sub>(.*?)<\/sub>/gs, "$1").replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

// --- parsing --------------------------------------------------------------

/** Pull the 北海道方言辞書 entry out of a word page's HTML. */
export function parseEntry(html) {
  const block = html.match(
    /<!--開始 北海道方言辞書 -->([\s\S]*?)<!--終了 北海道方言辞書-->/,
  );
  if (!block) return null;
  const body = block[1];

  const headword = (body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [, ""])[1];
  const head = stripTags(headword);

  // The dialect body lives in <div class=Hkdhj>. Match up to the newline
  // before its closing tag; the outer .kiji div must NOT be used to truncate
  // because its non-greedy match would cut off the gloss text.
  let dm = body.match(/<div class=Hkdhj[^>]*>([\s\S]*?)\n<\/div>/);
  if (!dm) dm = body.match(/<div[^>]*class="?Hkdhj"?[^>]*>([\s\S]*?)<\/div>/);
  if (!dm) dm = body.match(/<\/h2>\s*<div[^>]*>([\s\S]*)<\/div>/);
  const hk = dm ? dm[1] : "";
  if (!hk) {
    return { headword: head, reading: head, kanji: "", pos: [], region: [], gloss: "" };
  }

  let reading = stripTags((hk.match(/<span class="ve">([\s\S]*?)<\/span>/) || [, ""])[1]);
  if (!reading) reading = head;

  // Kanji notation is wrapped in 【...】. Anchor on that rather than the `not`
  // span, whose non-greedy match truncates on nested markup (【YOSAKOIソーラン】).
  const notSpan = hk.match(/<span class="not">([\s\S]*?)<\/span>\s*(?:<span class="pos"|$)/);
  const seg = notSpan ? notSpan[1] : hk.slice(0, 600);
  const bracket = seg.match(/【([\s\S]*?)】/);
  let kanji = bracket ? stripTags(bracket[1]).replace(/^【|】$/g, "") : "";
  // Drop trailing notes, keep okurigana parentheses such as 口取(り).
  kanji = kanji.split(/[】〔→]/)[0].trim();
  kanji = kanji.replace(/（[^）]{4,}）/g, "").replace(/\([^)]{4,}\)/g, "").trim();

  const collect = (cls, strip) => {
    const out = [];
    for (const m of hk.matchAll(new RegExp(`<span class="${cls}">([\\s\\S]*?)</span>`, "g"))) {
      const t = stripTags(m[1]).replace(strip, "").trim();
      if (t && !out.includes(t)) out.push(t);
    }
    return out;
  };
  const pos = collect("pos", /^\[|\]$/g);
  const region = collect("gnr", /^〈|〉$/g);

  let g = hk
    .replace(/<span class="ve">[\s\S]*?<\/span>/g, "")
    .replace(/<span class="pos">[\s\S]*?<\/span>/g, "")
    .replace(/<span class="not">[\s\S]*?<\/span>/g, "")
    .replace(/<span class="gnr">([\s\S]*?)<\/span>/g, " $1")
    .replace(/<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->/g, " ")
    .replace(/<!\[if[^\]]*\]>[\s\S]*?<!\[endif\]>/g, "")
    .replace(/<a [^>]*class=crosslink[^>]*>([\s\S]*?)<\/a>/g, "$1")
    .replace(/<a [^>]*>([\s\S]*?)<\/a>/g, "$1")
    .replace(/<sup>([\s\S]*?)<\/sup>/g, "$1");
  const gloss = stripTags(g).replace(/\s*〈([^〉]*)〉\s*/g, " ").trim();

  return { headword: head, reading, kanji, pos, region, gloss };
}

// --- crawl ----------------------------------------------------------------

async function crawl({ limit = 0 } = {}) {
  console.log(`fetching index ${INDEX_URL}`);
  const top = await fetchText(INDEX_URL);
  if (!top) throw new Error("could not load the index page");

  const slugs = [];
  for (const m of top.matchAll(
    /href="https:\/\/www\.weblio\.jp\/category\/dialect\/hkdhj\/([^"?#]+)"/g,
  )) {
    if (!slugs.includes(m[1])) slugs.push(m[1]);
  }
  console.log(`discovered ${slugs.length} sub-index pages`);

  // Collect every entry URL across all sub-index pages.
  const urls = new Map(); // url -> index label
  for (const slug of slugs) {
    const html = await fetchText(`${ORIGIN}/category/dialect/hkdhj/${slug}`);
    if (!html) continue;
    for (const m of html.matchAll(
      /href="(https:\/\/www\.weblio\.jp\/content\/[^"?]+\?dictCode=HKDHJ)"[^>]*>([^<]*)<\/a>/g,
    )) {
      if (!urls.has(m[1])) urls.set(m[1], m[2].trim());
    }
    await sleep(250);
  }
  console.log(`collected ${urls.size} entry links`);

  // Fetch and parse each entry page.
  const targets = limit > 0 ? [...urls].slice(0, limit) : [...urls];
  const entries = [];
  let done = 0;
  for (const [url, label] of targets) {
    const html = await fetchText(url);
    if (html) {
      const parsed = parseEntry(html);
      if (parsed && parsed.headword) entries.push({ ...parsed, url, label });
    }
    if (++done % 100 === 0) console.log(`  ...${done}/${targets.length}`);
    await sleep(300);
  }
  console.log(`parsed ${entries.length}/${targets.length} entries`);
  return entries;
}

// --- main -----------------------------------------------------------------

// Only run the crawl when invoked directly (so tests can import parseEntry).
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain && process.argv.includes("--offline")) {
  if (!existsSync(RAW_PATH)) throw new Error("data/raw.json does not exist yet");
  const raw = JSON.parse(readFileSync(RAW_PATH, "utf8"));
  console.log(`offline: data/raw.json has ${raw.entries.length} entries (rev ${raw.revision})`);
} else if (isMain) {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 0;
  const entries = await crawl({ limit });
  if (limit > 0) {
    // smoke test: don't clobber the committed snapshot with a partial crawl
    console.log(`--limit=${limit}: sampled ${entries.length} entries, not writing data/raw.json`);
    console.log(JSON.stringify(entries[0] ?? {}, null, 1));
  } else {
    const raw = {
      revision: new Date().toISOString().slice(0, 10),
      source: INDEX_URL,
      count: entries.length,
      entries,
    };
    mkdirSync(join(ROOT, "data"), { recursive: true });
    writeFileSync(RAW_PATH, JSON.stringify(raw, null, 1) + "\n");
    console.log(`wrote data/raw.json (${entries.length} entries)`);
  }
}
