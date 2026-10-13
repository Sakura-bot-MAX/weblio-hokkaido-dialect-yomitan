# Weblio 北海道方言 · Yomitan 词典

把 [Weblio 北海道方言辞書](https://www.weblio.jp/cat/dialect/hkdhj) 打包成 [Yomitan](https://github.com/yomidevs/yomitan) 词典，并且**可以在 Yomitan 里直接检查更新**。

## 安装

1. 到 [Releases](https://github.com/W1ght/weblio-hokkaido-dialect-yomitan/releases/latest) 下载 `weblio-hokkaido-dialect-yomitan.zip`
2. Yomitan → 设置 → Dictionaries → **Import** → 选择该 zip

## 更新

词典的 `index.json` 里带了 `isUpdatable` / `indexUrl` / `downloadUrl`，指向本仓库的 `releases/latest`。
装好之后，在 Yomitan 的 **Dictionaries** 页面点 **Check for updates**，有新版就能一键升级，不用重新导入。

上游站点的内容由 GitHub Actions 每天抓一次（`.github/workflows/update.yml`）：内容有变动才会重新构建、提交并发一个新 Release；没变动就什么都不做，所以不会给用户推没意义的更新提示。

## 数据来源

词条来自 Weblio 的北海道方言辞書。站点按假名把词条分成 66 个索引页（`/category/dialect/hkdhj/aa` … `/y`），每个词条页面里释义位于 `<!--開始 北海道方言辞書 -->` 注释块内的 `<div class=Hkdhj>` 中：

```html
<h2 class=midashigo title="えばる">えばる</h2>
<div class=Hkdhj>
  <span class="ve">え<b>ば</b>・る</span>        <!-- 读音（<b> 标音调下降点） -->
  <span class="not">【<a>威張る</a>】</span>      <!-- 漢字表記 -->
  <span class="pos">[動<sub>ラ五</sub>]</span>   <!-- 品詞 -->
  いばる。<span class="gnr">〈中〉</span>          <!-- 释义 + 地域 -->
</div>
```

构建脚本先抓索引首页自动发现全部 66 个子索引页，再逐个抓取词条页解析出「读音 / 漢字表記 / 品詞 / 地域 / 解説」。

## 构建

```
node src/fetch-data.mjs            # 联网抓取最新数据，写入 data/raw.json
node src/build.mjs                 # 从 data/raw.json 构建 dist/
```

产物在 `dist/`：`index.json`、`term_bank_1.json`、`weblio-hokkaido-dialect-yomitan.zip`。
zip 的时间戳取自 revision 日期，内容不变时输出逐字节一致，方便 CI 判断有无变化。

| 文件 | 作用 |
| --- | --- |
| `src/fetch-data.mjs` | 抓取索引与词条页，解析为 `data/raw.json` |
| `src/build.mjs` | 归一化词条 → Yomitan term bank → 打包 |
| `src/zip.mjs` | 无依赖的 deflate ZIP 写入器 |
| `data/raw.json` | 上游数据快照（提交进仓库，diff 就是词典的变更记录） |
| `dist/` | 构建产物（提交进仓库，供 CI 比对 revision） |

## 词条处理

Weblio 的索引会把同一个词按每种写法各列一次（假名 + 各个汉字写法），各自指向不同的 URL 但内容完全相同。构建时做了这些归一化：

- 按「读音 + 品詞 + 解説」归并同一个词的多种写法，`えばる` / `威張る` 合并成一条
- 漢字表記字段里的并列写法（`・` 分隔）与送假名括注（`口取(り)`、`骨付(き)ざんぎ`）展开成 `口取り`、`骨付きざんぎ` 等独立词头
- 每个汉字写法都作为**独立的可检索词头**收录，查假名或查汉字都能命中同一条释义
- 读音里的音调记号（`・` 下降点、`△`）在生成检索键时清除，但表头照常显示

1270 条原始词条 → 736 个词 → 1315 个可检索词头。

## 版权

词条内容版权归 [Weblio 北海道方言辞書](https://www.weblio.jp/cat/dialect/hkdhj) 所有，本仓库只做格式转换。构建脚本本身可自由使用。
