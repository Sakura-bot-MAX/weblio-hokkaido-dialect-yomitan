// Write output/README.md: a catalogue of every built dialect dictionary.
// Also injects the catalogue table into the root README.md between the
// <!-- DICT-TABLE-START --> / <!-- DICT-TABLE-END --> markers.
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
  rows.push({ slug: d.slug, name: d.name, title: d.title, entries: raw.count, terms: tb.length, rev: raw.revision });
}
rows.sort((a, b) => b.terms - a.terms);

const lines = [];
lines.push("# Weblio 方言辞典 Yomitan 版（全 23 種）");
lines.push("");
lines.push("来源：https://www.weblio.jp/cat/dialect ｜ 格式：Yomitan / Yomichan (format 3)");
lines.push("");
lines.push("| # | 辞典 | 收录音项 | 检索词条 | 快照版本 |");
lines.push("|---|---|---|---|---|");
rows.forEach((r, i) => {
  lines.push(`| ${i + 1} | ${r.name} | ${r.entries} | ${r.terms} | ${r.rev} |`);
});
lines.push("");
lines.push(`合计：23 部辞典，${totalEntries} 条音项，${totalTerms} 个检索词条。`);
lines.push("");
lines.push("## 安装方法（Yomitan / Yomichan）");
lines.push("");
lines.push("1. 打开 Yomitan 设置 → 辞書 → 导入（Import）");
lines.push("2. 选择本目录下任意一个 `[JA-JA Dialect] Weblio….zip`（可多选/全选）");
lines.push("3. 等待索引完成即可查询");
lines.push("");
lines.push("每个 zip 内含 `index.json`、`term_bank_1.json`、`icon.png`，已配置 `isUpdatable` 自更新字段（发布到 GitHub Release 后生效）。");
lines.push("");

const md = lines.join("\n");
writeFileSync(join(ROOT, "output", "README.md"), md);
console.log(md);

// --- root README.md table injection -----------------------------------------
const README = join(ROOT, "README.md");
if (existsSync(README)) {
  const START = "<!-- DICT-TABLE-START -->";
  const END = "<!-- DICT-TABLE-END -->";

  const t = [];
  t.push("| # | 辞典 | 見出し数 | 検索語数 | スナップショット | ダウンロード |");
  t.push("|---|---|---|---|---|---|");
  rows.forEach((r, i) => {
    const file = `[zip](output/${encodeURI(`[JA-JA Dialect] ${r.title}.zip`)})`;
    t.push(`| ${i + 1} | ${r.name} | ${r.entries} | ${r.terms} | ${r.rev} | ${file} |`);
  });
  t.push("");
  t.push(`合計 **23 辞典 / ${totalEntries} 見出し / ${totalTerms} 検索語**。`);
  const table = t.join("\n");

  const src = readFileSync(README, "utf8");
  const a = src.indexOf(START);
  const b = src.indexOf(END);
  if (a !== -1 && b !== -1 && b > a) {
    const next =
      src.slice(0, a + START.length) + "\n" + table + "\n" + src.slice(b);
    if (next !== src) {
      writeFileSync(README, next);
      console.log("README.md: catalogue table updated");
    } else {
      console.log("README.md: catalogue table unchanged");
    }
  } else {
    console.warn("README.md: markers not found, table not injected");
  }
}
