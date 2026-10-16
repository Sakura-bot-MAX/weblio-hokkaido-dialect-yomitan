# Weblio Dialect Dictionaries → Yomitan

Yomitan dictionaries built from **every** dialect dictionary in Weblio's
[dialect category](https://www.weblio.jp/cat/dialect) — 23 dictionaries covering
22 of Japan's 47 prefectures.

The same data ships in **two editions**, so you can pick how much you want to
carry around:

| Edition | Files | Use it when |
|---|---|---|
| **Per dialect** | 23 zips, one per dictionary | you want one region, or want to switch dialects on and off individually in Yomitan |
| **Combined** | 1 zip (`Weblio方言辞典 統合版`) | you want the whole dialect corpus in a single dictionary slot |

Both are built from the same snapshots by the same parser, so the two editions
can never disagree with each other.

## Combined edition

`Weblio方言辞典 統合版` contains every term from all 23 dictionaries in one
archive, published under the release tag `all`:

```
https://github.com/dtotaku/weblio-dialect-yomitan-dictionaries/releases/download/all/weblio-all-dialect-yomitan.zip
```

Nothing is re-parsed or re-summarised for it — the entries are the very same
terms as the 23 separate builds, in one `term_bank`, in `dictionaries.json`
order, and the definition bodies come out byte-identical. The only thing the
merge adds is a label saying where each entry came from:

- every entry carries one Yomitan definition tag, the Japanese name of the
  dictionary it came from (大阪弁, 北海道方言辞書, …). That tag is what tells the
  dialects apart once they share a single dictionary heading, and it is what
  Yomitan's tag filter uses to narrow the combined dictionary down to one
  dialect. The names already say which region they cover, so no separate region
  tag is added;
- the definition body is left alone — it does not repeat the dialect name, since
  the tag already shows it above every definition.

Because it already contains everything, installing the combined edition *and*
the per-dialect zips at once is pointless: Yomitan would show every word twice.
Pick one edition.

## Per-dialect editions

<!-- DICT-TABLE-START -->
| # | Dictionary | Region | Headwords | Lookup terms | Snapshot | Download |
|---|---|---|---|---|---|---|
| 1 | 大阪弁 (Osaka Dialect) | Osaka | 2,639 | 2,718 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E5%A4%A7%E9%98%AA%E5%BC%81.zip) |
| 2 | 甲州弁辞典 (Koshu Dialect Dictionary) | Yamanashi | 2,492 | 2,514 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E7%94%B2%E5%B7%9E%E5%BC%81.zip) |
| 3 | 沖縄大百科 (Okinawa Encyclopedia) | Okinawa | 2,008 | 2,044 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E6%B2%96%E7%B8%84%E5%A4%A7%E7%99%BE%E7%A7%91.zip) |
| 4 | 仙台弁 (Sendai Dialect) | Miyagi | 1,924 | 1,933 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E4%BB%99%E5%8F%B0%E5%BC%81.zip) |
| 5 | 魚津弁 (Uozu Dialect) | Toyama (Uozu) | 1,584 | 1,632 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E9%AD%9A%E6%B4%A5%E5%BC%81.zip) |
| 6 | 茨城弁大辞典 (Ibaraki Dialect Dictionary) | Ibaraki | 1,535 | 1,618 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E8%8C%A8%E5%9F%8E%E5%BC%81.zip) |
| 7 | 但馬方言辞典 (Tajima Dialect Dictionary) | Hyogo (Tajima) | 937 | 1,591 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E4%BD%86%E9%A6%AC%E6%96%B9%E8%A8%80.zip) |
| 8 | 津軽語辞典 (Tsugaru Dialect Dictionary) | Aomori (Tsugaru) | 1,432 | 1,439 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E6%B4%A5%E8%BB%BD%E8%AA%9E.zip) |
| 9 | 北海道方言辞書 (Hokkaido Dialect Dictionary) | Hokkaido | 1,312 | 1,320 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E5%8C%97%E6%B5%B7%E9%81%93%E6%96%B9%E8%A8%80.zip) |
| 10 | 奥豊後の言葉 (Oku-Bungo Dialect) | Oita (Bungo) | 1,246 | 1,289 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E5%A5%A5%E8%B1%8A%E5%BE%8C%E3%81%AE%E8%A8%80%E8%91%89.zip) |
| 11 | 新潟県田上町方言 (Tagami Dialect) | Niigata (Tagami) | 1,216 | 1,217 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E6%96%B0%E6%BD%9F%E7%9C%8C%E7%94%B0%E4%B8%8A%E7%94%BA%E6%96%B9%E8%A8%80.zip) |
| 12 | あがつま語 (Agatsuma Dialect) | Gunma (Agatsuma) | 1,190 | 1,209 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E3%81%82%E3%81%8C%E3%81%A4%E3%81%BE%E8%AA%9E.zip) |
| 13 | 東京方言辞典 (Tokyo Dialect Dictionary) | Tokyo | 1,185 | 1,185 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E6%9D%B1%E4%BA%AC%E6%96%B9%E8%A8%80.zip) |
| 14 | 鳥取弁辞書 (Tottori Dialect Dictionary) | Tottori | 1,045 | 1,058 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E9%B3%A5%E5%8F%96%E5%BC%81.zip) |
| 15 | 四日市市四郷地区方言 (Yokkaichi Shigo Dialect) | Mie (Yokkaichi) | 997 | 1,014 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E5%9B%9B%E6%97%A5%E5%B8%82%E5%B8%82%E5%9B%9B%E9%83%B7%E5%9C%B0%E5%8C%BA%E6%96%B9%E8%A8%80.zip) |
| 16 | 高松の方言 (Takamatsu Dialect) | Kagawa (Takamatsu) | 985 | 992 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E9%AB%98%E6%9D%BE%E3%81%AE%E6%96%B9%E8%A8%80.zip) |
| 17 | 和歌山弁辞書 (Wakayama Dialect Dictionary) | Wakayama | 916 | 918 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E5%92%8C%E6%AD%8C%E5%B1%B1%E5%BC%81.zip) |
| 18 | 京ことば (Kyo-kotoba) | Kyoto | 881 | 898 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E4%BA%AC%E3%81%93%E3%81%A8%E3%81%B0.zip) |
| 19 | 下北弁辞典 (Shimokita Dialect Dictionary) | Aomori (Shimokita) | 645 | 697 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E4%B8%8B%E5%8C%97%E5%BC%81.zip) |
| 20 | 博多弁辞典 (Hakata Dialect Dictionary) | Fukuoka (Hakata) | 517 | 593 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E5%8D%9A%E5%A4%9A%E5%BC%81.zip) |
| 21 | 名古屋弁辞典 (Nagoya Dialect Dictionary) | Aichi (Nagoya) | 416 | 420 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E5%90%8D%E5%8F%A4%E5%B1%8B%E5%BC%81.zip) |
| 22 | 焼津の方言 (Yaizu Dialect) | Shizuoka (Yaizu) | 258 | 267 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E7%84%BC%E6%B4%A5%E3%81%AE%E6%96%B9%E8%A8%80.zip) |
| 23 | 下関弁辞典 (Shimonoseki Dialect Dictionary) | Yamaguchi (Shimonoseki) | 242 | 252 | 2026-10-13 | [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E4%B8%8B%E9%96%A2%E5%BC%81.zip) |

**23 dictionaries / 27,602 headwords / 28,818 lookup terms** in total.

**Combined edition:** [zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E6%96%B9%E8%A8%80%E8%BE%9E%E5%85%B8%20%E7%B5%B1%E5%90%88%E7%89%88.zip) — all 28,818 lookup terms in a single dictionary (23 source dictionaries, 1890 KiB, snapshot 2026-10-13). Every entry is tagged with the Japanese name of the dialect it came from.
<!-- DICT-TABLE-END -->

## Install

1. Download the zip for the edition you want
2. In Yomitan: **Settings → Dictionaries → Import**, then pick the zip
3. The dictionaries declare `isUpdatable`, so Yomitan can update them in place
   afterwards

You can import as many per-dialect zips as you like; they coexist as separate
dictionaries.

## How lookups work

Headwords are taken verbatim from Weblio's own index — kana, kanji, or whatever
the source lists — so you look a word up the way the dictionary spells it. Where
an entry lists several spellings (Osaka あほくさい, あほらしい), any of them finds
it.

## Repository layout

```
dictionaries.json        definition of every dictionary (slug / code / metadata / English name / region)
src/fetch-data.mjs       crawls Weblio into data/<slug>.json snapshots
src/build.mjs            turns snapshots into per-dialect Yomitan dictionaries (format 3)
src/merged.mjs           metadata for the combined edition
src/build-merged.mjs     packs every snapshot into one dictionary (dist/all/)
src/publish.mjs          publishes both editions to GitHub Releases
src/lib/parse.mjs        parser shared by all dialect pages
src/lib/html.mjs         entity decoding / tag stripping helpers
src/index-md.mjs         generates the catalogue tables in the READMEs
src/validate.mjs         quality checks on both editions
src/check-samples.mjs    runs the parser against stored samples
data/<slug>.json         per-dictionary snapshot (git diff is the change history)
dist/<slug>/             per-dialect index.json / term_bank_1.json / zip
dist/all/                combined edition, same three files
```

## Building

```bash
node src/fetch-data.mjs            # crawl every dictionary (hours on a cold cache)
node src/fetch-data.mjs --slug=osaka
node src/fetch-data.mjs --offline  # just report on existing snapshots
node src/build.mjs                 # produce dist/<slug>/ (23 dictionaries)
node src/build-merged.mjs          # produce dist/all/ (combined edition)
node src/validate.mjs              # quality checks on both editions
node src/index-md.mjs              # refresh the README catalogue tables
```

Raw HTML is cached under `cache/<slug>/`, so an interrupted crawl resumes from
the cache instead of re-fetching (`cache/` is not tracked by git).

Both builds are deterministic: identical snapshots produce byte-identical zips,
so a rebuild that changed nothing produces no diff. The combined build runs the
per-dialect helpers over each snapshot in turn, so the two editions cannot drift
apart.

## About the parser

Every Weblio dialect dictionary shares the same page skeleton:

```html
<div class="kiji">
  <h2 class=midashigo title="reading">headword</h2>
  <div class=SlugCapitalised>…body…</div>
</div>
<!--開始 北海道方言辞書--> … <!--終了 北海道方言辞書-->
```

The body markup, however, differs from dictionary to dictionary, so
`src/lib/parse.mjs` auto-detects three shapes:

| Shape | Example | Handling |
| --- | --- | --- |
| `spans` | 北海道方言辞書 | reading, kanji, part of speech and region are read out of `<span class=ve/not/pos/gnr>` |
| `table` | 大阪弁, 博多弁 and most others | the table is carried over as Yomitan structured-content |
| `text` | あがつま語, 鳥取弁辞書 and others | `<br>` becomes a line break; plain text |

A `・` inside a headword means different things in different dictionaries — a
separator between alternative spellings in あがつま語, but a break inside the
okurigana in 博多弁. The parser decides from whether a `【kanji】` annotation is
present and whether the piece matches the index label.

## Coverage

The 23 dictionaries cover 22 prefectures (Aomori has two: Shimokita and Tsugaru).
25 prefectures are not covered by any Weblio dialect dictionary, and several of
the covered ones are single-town surveys rather than broad regional ones —
Yaizu, Tajima, Tagami and Uozu, for example.

## Licence

The text of each dictionary belongs to Weblio and to the individual dictionary
providers. This repository only reformats Weblio's public pages so Yomitan can
read them.
