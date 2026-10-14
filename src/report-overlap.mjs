// Render dist/overlap.json into a self-contained HTML report.
//
//   node src/report-overlap.mjs   ->  output/方言辞典重合分析.html

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const o = JSON.parse(readFileSync(join(ROOT, "dist", "overlap.json"), "utf8"));

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (n) => Number(n).toLocaleString("en-US");
const pct = (n) => `${n.toFixed(1)}%`;

// zip payload size
let zipBytes = 0;
for (const file of readdirSync(join(ROOT, "output"))) {
  if (file.endsWith(".zip")) zipBytes += statSync(join(ROOT, "output", file)).size;
}

// --- charts ---------------------------------------------------------------

/** Horizontal bars with a value label at the right. */
function hbars(items, { width = 620, rowH = 26, pad = 8, color = "#2f6fd0", max: forceMax } = {}) {
  const max = forceMax ?? Math.max(...items.map((i) => i.value));
  const labelW = 96;
  const barW = width - labelW - 70;
  const height = items.length * rowH + pad * 2;
  const rows = items
    .map((it, i) => {
      const y = pad + i * rowH;
      const w = max ? Math.max(2, (it.value / max) * barW) : 2;
      return `
      <text x="${labelW - 8}" y="${y + rowH * 0.62}" text-anchor="end" class="lbl">${esc(it.label)}</text>
      <rect x="${labelW}" y="${y + 5}" width="${w}" height="${rowH - 12}" rx="3" fill="${it.color || color}"/>
      <text x="${labelW + w + 6}" y="${y + rowH * 0.62}" class="val">${esc(it.text ?? f(it.value))}</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img">${rows}</svg>`;
}

/** 23x23 Jaccard heat-map. */
function heatmap() {
  const n = o.order.length;
  const cell = 22, left = 92, top = 92;
  const width = left + n * cell + 12;
  const height = top + n * cell + 12;
  let max = 0;
  for (const row of o.matrix) for (const v of row) if (v < 1 && v > max) max = v;
  const shade = (v) => {
    if (v === 1) return "#1b3a63";
    const t = max ? Math.min(1, v / max) : 0;
    const a = 0.06 + t * 0.9;
    return `rgba(47,111,208,${a.toFixed(3)})`;
  };
  let cells = "";
  for (let i = 0; i < n; i++) {
    cells += `<text x="${left - 6}" y="${top + i * cell + 15}" text-anchor="end" class="hm">${esc(o.order[i])}</text>`;
    cells += `<text x="${left + i * cell + 11}" y="${top - 8}" text-anchor="start" class="hm" transform="rotate(-60 ${left + i * cell + 11} ${top - 8})">${esc(o.order[i])}</text>`;
    for (let j = 0; j < n; j++) {
      const v = o.matrix[i][j];
      cells += `<rect x="${left + j * cell}" y="${top + i * cell}" width="${cell - 1}" height="${cell - 1}" fill="${shade(v)}"><title>${esc(o.order[i])} × ${esc(o.order[j])} = ${(v * 100).toFixed(1)}%</title></rect>`;
    }
  }
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img">${cells}</svg>`;
}

/** Stacked bar for agree / disagree. */
function stackedAgree() {
  const total = o.meaningAgree + o.meaningDisagree;
  const w = 620, h = 54;
  const aW = (o.meaningAgree / total) * w;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">
    <rect x="0" y="10" width="${w}" height="30" rx="4" fill="#e6e9ef"/>
    <rect x="0" y="10" width="${aW}" height="30" rx="4" fill="#2e9e6b"/>
    <text x="12" y="31" class="onbar">意思一致 ${f(o.meaningAgree)}（${pct(o.agreePctOfShared)}）</text>
    <text x="${w - 12}" y="31" text-anchor="end" class="onbar">同形异义 ${f(o.meaningDisagree)}（${pct(o.disagreePctOfShared)}）</text>
  </svg>`;
}

// --- tables ---------------------------------------------------------------

function table(headers, rows, cls = "") {
  return `<table class="${cls}"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

const bucketItems = [
  { label: "仅 1 部", value: o.buckets["1"], color: "#8fb8e8" },
  { label: "2 部", value: o.buckets["2"], color: "#5f95d8" },
  { label: "3–5 部", value: o.buckets["3-5"], color: "#2f6fd0" },
  { label: "6–10 部", value: o.buckets["6-10"], color: "#1b4f9c" },
  { label: "11 部以上", value: o.buckets["11+"], color: "#123a75" },
];

const dictBarItems = o.perDict
  .slice()
  .sort((a, b) => b.pctStrict - a.pctStrict)
  .map((p) => ({ label: p.slug, value: p.pctStrict, text: `${p.pctStrict.toFixed(1)}%  (${p.strict})` }));

const sharedRows = o.topAgree.slice(0, 20).map((r) => [
  `<b>${esc(r.key)}</b>`,
  `${r.n} 部`,
  esc(r.common.meaning),
  `${r.common.c} 部一致`,
]);

const disagreeRows = o.topDisagree.slice(0, 18).map((r) => [
  `<b>${esc(r.key)}</b>`,
  `${r.n} 部`,
  r.meanings.map((m) => esc(m)).join(" ／ "),
]);

const conceptRows = o.topConcepts.slice(0, 20).map((c) => [esc(c.concept), `${c.n} 部`]);

const pairRows = o.topPairs.slice(0, 12).map((p) => [
  `${esc(p.a)} × ${esc(p.b)}`,
  f(p.inter),
  pct(p.jaccard * 100),
]);

const dictRows = o.perDict.map((p) => [
  `<b>${esc(p.slug)}</b>`,
  esc(p.name),
  f(p.total),
  `${p.strict} (${p.pctStrict.toFixed(1)}%)`,
  `${p.loose} (${p.pctLoose.toFixed(1)}%)`,
  esc(p.exStrict.slice(0, 5).join("・")),
]);

// --- assemble -------------------------------------------------------------

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Weblio 方言辞典 重合分析</title>
<style>
  :root { --ink:#1d2733; --muted:#67748a; --line:#e3e7ee; --bg:#f6f8fb; --card:#fff; --accent:#2f6fd0; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
         font-family:"Yu Gothic UI","Hiragino Sans","Noto Sans JP","Microsoft YaHei",system-ui,sans-serif;
         line-height:1.75; font-size:15px; }
  .wrap { max-width:960px; margin:0 auto; padding:40px 24px 80px; }
  h1 { font-size:27px; margin:0 0 6px; letter-spacing:.01em; }
  h2 { font-size:19px; margin:44px 0 14px; padding-bottom:8px; border-bottom:2px solid var(--line); }
  h3 { font-size:16px; margin:26px 0 10px; color:#2b3a4d; }
  .sub { color:var(--muted); margin:0 0 26px; font-size:14px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin:22px 0 8px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px 16px 14px; }
  .card .n { font-size:25px; font-weight:700; letter-spacing:-.01em; }
  .card .t { font-size:12.5px; color:var(--muted); margin-top:2px; }
  .panel { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:18px 20px; margin:14px 0; }
  .note { background:#fff8e6; border:1px solid #f0dca8; border-radius:8px; padding:12px 16px; font-size:13.5px; color:#6b5a20; }
  svg .lbl { font-size:12px; fill:#42506a; }
  svg .val { font-size:11.5px; fill:#67748a; }
  svg .hm  { font-size:10px; fill:#54627a; }
  svg .onbar { font-size:12.5px; fill:#fff; font-weight:600; }
  table { width:100%; border-collapse:collapse; font-size:13.5px; }
  th { text-align:left; font-weight:600; color:#42506a; border-bottom:2px solid var(--line); padding:8px 10px; white-space:nowrap; }
  td { border-bottom:1px solid #eef1f6; padding:7px 10px; vertical-align:top; }
  tbody tr:hover { background:#f7faff; }
  .two { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media (max-width:720px){ .two { grid-template-columns:1fr; } }
  .legend { font-size:12.5px; color:var(--muted); margin-top:8px; }
  ul { padding-left:20px; } li { margin:5px 0; }
  code { background:#eef2f8; padding:1px 5px; border-radius:4px; font-size:13px; }
  .kpi { font-weight:700; color:var(--accent); }
</style>
</head>
<body>
<div class="wrap">

<h1>Weblio 方言辞典 · 重合分析</h1>
<p class="sub">对象：<b>23 部</b> Weblio 方言辞典（共 ${f(o.totalEntries)} 条音项）｜口径：词形经「片假名→平假名 + NFKC + 去装饰符」归一化后比对</p>

<div class="cards">
  <div class="card"><div class="n">${f(o.totalEntries)}</div><div class="t">原始音项</div></div>
  <div class="card"><div class="n">${f(o.totalForms)}</div><div class="t">去重后词形</div></div>
  <div class="card"><div class="n">${pct(o.sharedPct)}</div><div class="t">出现在 ≥2 部辞典</div></div>
  <div class="card"><div class="n">${pct(o.agreePctOfShared)}</div><div class="t">重合词中「意思一致」</div></div>
  <div class="card"><div class="n">${pct(o.pctStrict)}</div><div class="t">与共通语同形</div></div>
</div>

<div class="note">
  <b>一句话结论：</b>23 部辞典的冗余度很低——<span class="kpi">${pct(100 - o.sharedPct)}</span> 的词形只出现在一部辞典里；
  即便词形相同，也只有 <span class="kpi">${pct(o.agreePctOfShared)}</span> 意思一致，其余 <span class="kpi">${pct(o.disagreePctOfShared)}</span> 属「同形异义」；
  真正与共通语同形的仅 <span class="kpi">${pct(o.pctStrict)}</span>。全量安装不会带来明显重复，但跨方言查词必须看释义。
</div>

<h2>一、方言辞典之间的重合</h2>

<h3>1.1 词形重合分布</h3>
<div class="panel">
  ${hbars(bucketItems)}
  <div class="legend">横轴为该类词形数量。共 ${f(o.totalForms)} 个不同词形，其中 ${f(o.sharedForms)} 个（${pct(o.sharedPct)}）出现在 2 部及以上辞典。</div>
</div>

<h3>1.2 两两重合热力图（Jaccard 相似度）</h3>
<div class="panel">
  ${heatmap()}
  <div class="legend">颜色越深表示两部辞典收录的词形越接近（对角线为自身，置为最深）。整体色调偏浅，说明任意两部之间重合都不高。</div>
</div>

<h3>1.3 最接近的辞典对</h3>
<div class="panel">
  ${table(["辞典对", "共同词形数", "Jaccard"], pairRows)}
</div>

<h2>二、意思的重合</h2>

<h3>2.1 一致 vs 同形异义</h3>
<div class="panel">
  ${stackedAgree()}
  <div class="legend">分母为 ${f(o.sharedForms)} 个「出现在 ≥2 部辞典」的词形。其中 <b>${f(o.meaningAgreeFull)}</b> 个在所有出现该词的辞典里释义完全一致。</div>
</div>

<h3>2.2 意思一致的代表词（跨方言通用）</h3>
<div class="panel">
  ${table(["词形", "出现辞典数", "共同释义", "一致度"], sharedRows)}
</div>

<h3>2.3 同形异义的代表词（跨方言「假朋友」）</h3>
<div class="panel">
  ${table(["词形", "出现辞典数", "各方言释义"], disagreeRows)}
  <div class="legend">同一书写形在不同方言里意思可以完全不同，例如「めんめ」在北海道指<b>喜知次鱼</b>、仙台指<b>虫子</b>（幼儿语）、上州指<b>乌冬面</b>。</div>
</div>

<h2>三、与共通语（大众语）的重合</h2>

<h3>3.1 各辞典「词形即共通语」比例（严格口径）</h3>
<div class="panel">
  ${hbars(dictBarItems, { color: "#2e9e6b" })}
  <div class="legend">严格口径 = 只取表头明确标注「共通語／訳語」的释义列（大阪弁、田上町、名古屋弁、但馬、四日市 五部），这些列一定是标准日语，不会混入方言词。</div>
</div>

<h3>3.2 口径说明</h3>
<div class="panel">
  ${table(
    ["口径", "共通语词表规模", "命中的方言词形", "占比"],
    [
      ["严格（仅「共通語／訳語」列）", f(o.strictVocab), f(o.totalStrict), pct(o.pctStrict)],
      ["宽松（全部「意味」列）", f(o.looseVocab), f(o.totalLoose), pct(o.pctLoose)],
      ["词形 = 自身释义（自明同形）", "—", f(o.selfIdForms), "—"],
    ],
  )}
  <div class="legend">判定方法：把辞典的释义列当作「标准日语词表」，若某方言词形也出现在该词表中，说明它在别处被当作标准语使用。宽松口径会把少量「用甲方言词解释乙方言词」的情况算进来，故偏高。</div>
</div>

<h3>3.3 逐辞典明细</h3>
<div class="panel">
  ${table(["slug", "辞典", "词形数", "严格命中", "宽松命中", "示例"], dictRows)}
</div>

<h2>四、共通语概念在各方言中的分布</h2>
<div class="panel">
  <div class="two">
    <div>${table(["共通语概念", "被多少部辞典收录为释义"], conceptRows.slice(0, 10))}</div>
    <div>${table(["共通语概念", "被多少部辞典收录为释义"], conceptRows.slice(10, 20))}</div>
  </div>
  <div class="legend">这些是「各地方言说法最多样」的概念——同一个意思在不同方言里有不同词，正是方言差异最集中的地方。</div>
</div>

<h2>五、结论与建议</h2>
<div class="panel">
  <ul>
    <li><b>冗余度低，可全量安装。</b>23 部合计 23 个 zip、约 ${(zipBytes / 1024 / 1024).toFixed(1)} MB，去重后 ${f(o.totalForms)} 个词形中 ${pct(100 - o.sharedPct)} 只出现在一部辞典里。</li>
    <li><b>重合部分多为「同形异义」。</b>共享词形里 ${pct(o.disagreePctOfShared)} 意思不同，占全部词形的 ${pct((o.meaningDisagree / o.totalForms) * 100)}，这是方言研究里最有价值的部分，也意味着<b>不能按词形跨方言套用释义</b>。</li>
    <li><b>绝大部分词条是真正的方言词。</b>与共通语同形的仅 ${pct(o.pctStrict)}（严格）／${pct(o.pctLoose)}（宽松），说明这些辞典不是「标准语换个说法」，而是实打实的方言词汇。</li>
    <li><b>最接近的是京ことば × 大阪弁</b>（共同词形 ${f(o.topPairs[0].inter)} 个，Jaccard ${pct(o.topPairs[0].jaccard * 100)}），同属近畿方言圈，符合语言地理学预期。</li>
    <li><b>差异最集中的概念</b>是「小さい」「くすぐったい」「たくさん」「ずるい」「とうもろこし」「動く」等，被 10 部以上辞典收录——想了解方言差异，从这些词入手最有效率。</li>
  </ul>
</div>

<p class="sub" style="margin-top:34px">数据来源：https://www.weblio.jp/cat/dialect ｜ 生成脚本：<code>src/analyze-overlap.mjs</code> + <code>src/report-overlap.mjs</code></p>

</div>
</body>
</html>`;

mkdirSync(join(ROOT, "output"), { recursive: true });
writeFileSync(join(ROOT, "output", "方言辞典重合分析.html"), html);
console.log(`wrote output/方言辞典重合分析.html (${(html.length / 1024).toFixed(0)} KiB)`);
