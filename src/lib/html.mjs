// Shared HTML helpers for the Weblio dialect pipeline.
//
// Weblio serves plain, mostly well-formed HTML, so a handful of regexes is
// enough and keeps the whole toolchain dependency-free.

// Named character references. Latin-1 supplement plus the common typographic
// entities — which is what actually shows up in this source.
export const NAMED_ENTITIES = {
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

function safeCodePoint(code) {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

export const decodeEntities = (s) =>
  String(s)
    // numeric character references, decimal (&#25620;) and hex (&#x6414;)
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(Number(d)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) => safeCodePoint(parseInt(h, 16)))
    // named references
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name)
        ? NAMED_ENTITIES[name]
        : m,
    );

/** Drop every tag and decode entities, collapsing runs of whitespace. */
export function stripTags(s) {
  return decodeEntities(
    String(s)
      .replace(/<rp>[\s\S]*?<\/rp>/g, "")
      .replace(/<rt>[\s\S]*?<\/rt>/g, "")
      .replace(/<sub>(.*?)<\/sub>/gs, "$1")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Like stripTags but keeps the block structure: <br>, </p>, </tr> become
 * newlines and </td>/</th> become tabs. Used for table bodies and free text
 * so multi-line definitions survive into the dictionary.
 */
export function textWithBreaks(s) {
  const marked = String(s)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<rp>[\s\S]*?<\/rp>/gi, "")
    .replace(/<rt>[\s\S]*?<\/rt>/gi, "")
    .replace(/<ruby[^>]*>/gi, "")
    .replace(/<\/ruby>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<hr[^>]*>/gi, "\n")
    .replace(/<\/t[dh]\s*>/gi, "\t")
    .replace(/<\/tr\s*>/gi, "\n")
    .replace(/<\/h[1-6]\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const text = decodeEntities(marked);
  return text
    .split("\n")
    .map((line) =>
      line
        .split("\t")
        .map((cell) => cell.replace(/\s+/g, " ").trim())
        .join("\t")
        .replace(/\t+$/, ""),
    )
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

/** Collapse a definition blob into single-spaced text. */
export const squash = (s) => String(s).replace(/\s+/g, " ").trim();
