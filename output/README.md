# Weblio Dialect Dictionaries — Yomitan edition (all 23)

Source: <https://www.weblio.jp/cat/dialect> | Format: Yomitan / Yomichan (format 3)

Two editions are shipped from the same data:

| Edition | Files | Use it when |
|---|---|---|
| Per dialect | 23 zips, one per dictionary | you want one region, or want to switch dialects on and off separately |
| Combined | `[JA-JA Dialect] Weblio方言辞典 統合版.zip` | you want the whole dialect corpus in a single dictionary slot |

## Per-dialect editions

| # | Dictionary | Region | Headwords | Lookup terms | Snapshot |
|---|---|---|---|---|---|
| 1 | 大阪弁 (Osaka Dialect) | Osaka | 2,639 | 2,718 | 2026-10-13 |
| 2 | 甲州弁辞典 (Koshu Dialect Dictionary) | Yamanashi | 2,492 | 2,514 | 2026-10-13 |
| 3 | 沖縄大百科 (Okinawa Encyclopedia) | Okinawa | 2,008 | 2,044 | 2026-10-13 |
| 4 | 仙台弁 (Sendai Dialect) | Miyagi | 1,924 | 1,933 | 2026-10-13 |
| 5 | 魚津弁 (Uozu Dialect) | Toyama (Uozu) | 1,584 | 1,632 | 2026-10-13 |
| 6 | 茨城弁大辞典 (Ibaraki Dialect Dictionary) | Ibaraki | 1,535 | 1,618 | 2026-10-13 |
| 7 | 但馬方言辞典 (Tajima Dialect Dictionary) | Hyogo (Tajima) | 937 | 1,591 | 2026-10-13 |
| 8 | 津軽語辞典 (Tsugaru Dialect Dictionary) | Aomori (Tsugaru) | 1,432 | 1,439 | 2026-10-13 |
| 9 | 北海道方言辞書 (Hokkaido Dialect Dictionary) | Hokkaido | 1,312 | 1,320 | 2026-10-13 |
| 10 | 奥豊後の言葉 (Oku-Bungo Dialect) | Oita (Bungo) | 1,246 | 1,289 | 2026-10-13 |
| 11 | 新潟県田上町方言 (Tagami Dialect) | Niigata (Tagami) | 1,216 | 1,217 | 2026-10-13 |
| 12 | あがつま語 (Agatsuma Dialect) | Gunma (Agatsuma) | 1,190 | 1,209 | 2026-10-13 |
| 13 | 東京方言辞典 (Tokyo Dialect Dictionary) | Tokyo | 1,185 | 1,185 | 2026-10-13 |
| 14 | 鳥取弁辞書 (Tottori Dialect Dictionary) | Tottori | 1,045 | 1,058 | 2026-10-13 |
| 15 | 四日市市四郷地区方言 (Yokkaichi Shigo Dialect) | Mie (Yokkaichi) | 997 | 1,014 | 2026-10-13 |
| 16 | 高松の方言 (Takamatsu Dialect) | Kagawa (Takamatsu) | 985 | 992 | 2026-10-13 |
| 17 | 和歌山弁辞書 (Wakayama Dialect Dictionary) | Wakayama | 916 | 918 | 2026-10-13 |
| 18 | 京ことば (Kyo-kotoba) | Kyoto | 881 | 898 | 2026-10-13 |
| 19 | 下北弁辞典 (Shimokita Dialect Dictionary) | Aomori (Shimokita) | 645 | 697 | 2026-10-13 |
| 20 | 博多弁辞典 (Hakata Dialect Dictionary) | Fukuoka (Hakata) | 517 | 593 | 2026-10-13 |
| 21 | 名古屋弁辞典 (Nagoya Dialect Dictionary) | Aichi (Nagoya) | 416 | 420 | 2026-10-13 |
| 22 | 焼津の方言 (Yaizu Dialect) | Shizuoka (Yaizu) | 258 | 267 | 2026-10-13 |
| 23 | 下関弁辞典 (Shimonoseki Dialect Dictionary) | Yamaguchi (Shimonoseki) | 242 | 252 | 2026-10-13 |

Total: 23 dictionaries, 27,602 headwords, 28,818 lookup terms.

## Combined edition

[zip](output/%5BJA-JA%20Dialect%5D%20Weblio%E6%96%B9%E8%A8%80%E8%BE%9E%E5%85%B8%20%E7%B5%B1%E5%90%88%E7%89%88.zip) — all 28,818 lookup terms in a single dictionary (23 source dictionaries, 1890 KiB, snapshot 2026-10-13). Every entry is tagged with the Japanese name of the dialect it came from.

The combined zip holds the same 28,818 lookup terms as the 23 separate builds, so nothing is lost or duplicated — the same entries in one file, each tagged with the Japanese name of its source dictionary, which is also what Yomitan's tag filter uses to narrow the dictionary down to a single dialect.

## Install (Yomitan / Yomichan)

1. Open Yomitan settings → Dictionaries → Import
2. Pick either edition: any `[JA-JA Dialect] Weblio….zip` from this folder (you can select several at once)
3. Wait for the index to finish, then look words up

Installing both editions at once is not useful — the combined one already contains everything,
and Yomitan would show each word twice.

Each zip contains `index.json`, `term_bank_1.json` and `icon.png`, and declares
`isUpdatable` so Yomitan can update it in place once it is published to a GitHub release.
