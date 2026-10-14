// Generic parser for the Weblio dialect dictionaries.
//
// Every dialect dictionary on weblio.jp shares the same page skeleton:
//
//     <div class="kiji">
//         <h2 class=midashigo title="読み">見出し</h2>
//         <div class=SlugCapitalised> …本文… </div>   (or <table class=…>)
//         <hr class=dot>
//         <h2 class=midashigo …>…</h2>                  (次の項目)
//     </div>
//
// and the dictionary's own slice is fenced by HTML comments:
//
//     <!--開始 北海道方言辞書--> … <!--終了 北海道方言辞書-->
//
// The *body* markup differs per dictionary (plain text, a table, or the
// 北海道-style <span class=ve/not/pos/gnr> header), so the body parser
// auto-detects which of the three shapes it is looking at.

import { decodeEntities, stripTags, textWithBreaks, squash } from "./html.mjs";

// --- region / entry splitting --------------------------------------------

/** Return the HTML between the 開始/終了 comment markers, or null. */
export function extractRegion(html) {
  const m = String(html).match(
    /<!--\s*開始\s+([^>]*?)\s*-->([\s\S]*?)<!--\s*終了\s+[^>]*?-->/,
  );
  return m ? { name: m[1].trim(), body: m[2] } : null;
}

/** Collect the <h2 class=midashigo> headings and the body that follows each. */
export function splitEntries(region) {
  const heads = [];
  const re = /<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi;
  let m;
  while ((m = re.exec(region))) {
    if (!/\bmidashigo\b/i.test(m[1])) continue;
    const title =
      (m[1].match(/\btitle\s*=\s*"([^"]*)"/i) ||
        m[1].match(/\btitle\s*=\s*'([^']*)'/i))?.[1];
    heads.push({
      title: title ? decodeEntities(title) : "",
      inner: m[2],
      start: m.index,
      end: re.lastIndex,
    });
  }
  const out = [];
  for (let i = 0; i < heads.length; i++) {
    const stop = i + 1 < heads.length ? heads[i + 1].start : region.length;
    out.push({
      title: heads[i].title,
      inner: heads[i].inner,
      body: region.slice(heads[i].end, stop),
    });
  }
  return out;
}

// --- body shapes ----------------------------------------------------------

/** Parse the first <table> in the body into rows of cell strings. */
function parseTable(body) {
  const tm = body.match(/<table\b[^>]*>([\s\S]*?)<\/table>/i);
  if (!tm) return null;
  const rows = [];
  for (const rm of tm[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [];
    for (const cm of rm[1].matchAll(/<(t[dh])\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)) {
      cells.push(squash(textWithBreaks(cm[2])));
    }
    if (cells.some((c) => c !== "")) rows.push(cells);
  }
  return rows.length ? rows : null;
}

/** 北海道-style <span class=ve|not|pos|gnr> header. */
function parseSpans(body) {
  const reading = stripTags((body.match(/<span class="ve">([\s\S]*?)<\/span>/) || [, ""])[1]);

  const notSpan = body.match(/<span class="not">([\s\S]*?)<\/span>\s*(?:<span class="pos"|$)/);
  const seg = notSpan ? notSpan[1] : body.slice(0, 600);
  const bracket = seg.match(/【([\s\S]*?)】/);
  let kanji = bracket ? stripTags(bracket[1]).replace(/^【|】$/g, "") : "";
  kanji = kanji.split(/[】〔→]/)[0].trim();
  kanji = kanji.replace(/（[^）]{4,}）/g, "").replace(/\([^)]{4,}\)/g, "").trim();

  const collect = (cls, strip) => {
    const out = [];
    for (const m of body.matchAll(new RegExp(`<span class="${cls}">([\\s\\S]*?)</span>`, "g"))) {
      const t = stripTags(m[1]).replace(strip, "").trim();
      if (t && !out.includes(t)) out.push(t);
    }
    return out;
  };

  let g = body
    .replace(/<span class="ve">[\s\S]*?<\/span>/g, "")
    .replace(/<span class="pos">[\s\S]*?<\/span>/g, "")
    .replace(/<span class="not">[\s\S]*?<\/span>/g, "")
    .replace(/<span class="gnr">([\s\S]*?)<\/span>/g, " $1")
    .replace(/<!--\[if[^\]]*\]>[\s\S]*?<!\[endif\]-->/g, " ")
    .replace(/<!\[if[^\]]*\]>[\s\S]*?<!\[endif\]>/g, "")
    .replace(/<a [^>]*class=crosslink[^>]*>([\s\S]*?)<\/a>/g, "$1")
    .replace(/<a [^>]*>([\s\S]*?)<\/a>/g, "$1")
    .replace(/<sup>([\s\S]*?)<\/sup>/g, "$1");
  const gloss = squash(stripTags(g).replace(/\s*〈([^〉]*)〉\s*/g, " "));

  return {
    mode: "spans",
    reading,
    kanji,
    pos: collect("pos", /^\[|\]$/g),
    region: collect("gnr", /^〈|〉$/g),
    gloss,
  };
}

/** Auto-detect the body shape and normalise it. */
export function parseBody(body) {
  const clean = String(body).replace(/<hr[^>]*class=["']?dot["']?[^>]*>/gi, "");

  if (/<span[^>]*class=["']?ve["']?/i.test(clean)) return parseSpans(clean);

  const rows = parseTable(clean);
  if (rows) {
    // Text that sits outside the table (e.g. a note after it) is kept as-is.
    const leftover = squash(textWithBreaks(clean.replace(/<table\b[^>]*>[\s\S]*?<\/table>/i, " ")));
    return { mode: "table", rows, note: leftover };
  }

  const text = textWithBreaks(clean);
  return { mode: "text", text };
}

// --- whole page -----------------------------------------------------------

/** Strip the ①②… sense markers and leading ～ that headings sometimes carry. */
const tidyForm = (s) =>
  String(s)
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]+/g, "")
    .replace(/^[～~]+/, "")
    .replace(/[\s"'“”「」]+$/g, "")
    .replace(/^[\s"'“”「」]+/g, "")
    .trim();

const KANA_ONLY = /^[\u3041-\u309F\u30A0-\u30FF\u30FC\u30FB\u30FD\u30FEー]+$/;

/**
 * Written forms shown in the heading, e.g. "あほくさい、あほらしい" -> two
 * forms.  "・" is ambiguous: あがつま語 uses it to separate spellings
 * ("～があ・いい") while 博多弁 uses it to split a stem from its okurigana
 * ("お・る【居る】"). It is treated as an okurigana split when the heading
 * carries a 【漢字】 annotation or when dropping it reproduces the index label.
 */
export function displayVariants(inner, label = "") {
  const out = [];
  const raw = String(inner);
  const hasKanjiAnn = /【[^】]*】/.test(raw);
  const cleaned = stripTags(raw)
    .replace(/【[^】]*】/g, "")
    .replace(/[（(][^）)]*[）)]/g, "");
  const lab = tidyForm(label);

  for (const chunk of cleaned.split(/[、，,/／]+/)) {
    const pieces = [];
    if (chunk.includes("・")) {
      const joined = tidyForm(chunk.replace(/[・･]/g, ""));
      const joinOk =
        (hasKanjiAnn && KANA_ONLY.test(joined)) ||
        (lab && joined && (joined === lab || joined.startsWith(lab) || lab.startsWith(joined)));
      if (joinOk) pieces.push(joined);
      else pieces.push(...chunk.split(/[・･]/));
    } else {
      pieces.push(chunk);
    }
    for (const p of pieces) {
      const t = tidyForm(p);
      if (t && !out.includes(t)) out.push(t);
    }
  }
  return out;
}

/** Kanji spellings written in 【…】 inside the heading. */
export function headingKanji(inner) {
  const out = [];
  for (const m of String(inner).matchAll(/【([^】]*)】/g)) {
    const t = tidyForm(stripTags(m[1]));
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/**
 * Parse one Weblio word page.
 * @param {string} html
 * @param {{label?: string}} [options] index label, used to disambiguate ・
 * @returns {Array<object>}
 */
export function parsePage(html, { label = "" } = {}) {
  const region = extractRegion(html);
  if (!region) return [];

  const parts = splitEntries(region.body);
  const entries = [];
  for (const part of parts) {
    const headword = part.title || stripTags(part.inner);
    if (!headword) continue;
    const body = parseBody(part.body);
    const kanji = [body.kanji, ...headingKanji(part.inner)].filter(Boolean);
    entries.push({
      headword,
      display: stripTags(part.inner),
      variants: displayVariants(part.inner, label),
      reading: body.reading || "",
      kanji: [...new Set(kanji)].join("・"),
      pos: body.pos || [],
      region: body.region || [],
      mode: body.mode,
      rows: body.rows || null,
      note: body.note || "",
      gloss: body.gloss || "",
      text: body.text || "",
    });
  }
  return entries;
}
