// The combined edition: all twenty-three dialect dictionaries in one archive.
//
// The repository ships two editions of the same data:
//
//   * per dialect — dist/<slug>/, one release tag per dictionary, so installing
//     a single dialect does not drag in the other twenty-two;
//   * combined    — dist/all/, one release tag for everything, for readers who
//     want the whole dialect corpus in a single dictionary slot.
//
// Both are built from the same snapshots with the same parser, so the combined
// edition never disagrees with the individual ones. Every combined entry keeps
// the name of the dictionary it came from, both as a label inside the
// definition and as a Yomitan definition tag — once everything shares one
// dictionary heading, that tag is what tells 大阪弁 apart from 北海道方言.

/** Slug of the combined edition. Also its release tag. */
export const MERGED_SLUG = "all";

export const MERGED = {
  slug: MERGED_SLUG,
  title: "Weblio方言辞典 統合版",
  author: "Weblio dialect dictionaries (23 titles combined)",
  description:
    "23 部の Weblio 方言辞典を 1 冊にまとめた統合版です。各項目には出典の辞典名が付きます。",
  url: "https://www.weblio.jp/cat/dialect",
};

/** Asset name inside a release. Same pattern for every dictionary, so the
 *  publisher does not need to special-case the combined edition. */
export const zipNameFor = (slug) => `weblio-${slug}-dialect-yomitan.zip`;
