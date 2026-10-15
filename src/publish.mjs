// Publish the built dictionaries to GitHub Releases.
//
//   GITHUB_TOKEN=... node src/publish.mjs
//   GITHUB_TOKEN=... node src/publish.mjs --slug=osaka
//   GITHUB_TOKEN=... node src/publish.mjs --force      # re-upload everything
//
// Every dictionary lives on its own release tag (the slug), so Yomitan's
// self-update URLs stay stable:
//
//   .../releases/download/<slug>/index.json
//   .../releases/download/<slug>/weblio-<slug>-dialect-yomitan.zip
//
// dist/published.json records the repository and revision that are currently
// online, so an unchanged dictionary is never re-uploaded.
//
// The repository name is part of that record on purpose: index.json embeds its
// own release URLs, so renaming the repository invalidates every published
// asset even though the upstream data has not changed by a single byte.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO =
  process.env.YOMITAN_REPO || process.env.GITHUB_REPOSITORY || "";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const API = "https://api.github.com";

if (!REPO) throw new Error("set YOMITAN_REPO=owner/name");
if (!TOKEN) throw new Error("set GITHUB_TOKEN");

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "weblio-dialect-yomitan",
};

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

async function ensureRelease(tag) {
  const existing = await api(`/repos/${REPO}/releases/tags/${tag}`);
  if (existing.ok) return existing.json;
  if (existing.status !== 404) {
    throw new Error(`lookup ${tag} failed: ${existing.status} ${existing.text.slice(0, 200)}`);
  }
  const created = await api(`/repos/${REPO}/releases`, {
    method: "POST",
    body: JSON.stringify({
      tag_name: tag,
      name: tag,
      target_commitish: process.env.GITHUB_REF_NAME || "main",
      body: "Auto-generated Yomitan dictionary build.",
    }),
  });
  if (!created.ok) {
    throw new Error(`create ${tag} failed: ${created.status} ${created.text.slice(0, 300)}`);
  }
  return created.json;
}

async function replaceAsset(release, name, data) {
  const list = await api(`/repos/${REPO}/releases/${release.id}/assets?per_page=100`);
  for (const a of list.json || []) {
    if (a.name === name) {
      await api(`/repos/${REPO}/releases/assets/${a.id}`, { method: "DELETE" });
    }
  }
  const res = await fetch(
    `https://uploads.github.com/repos/${REPO}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
    {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/octet-stream" },
      body: data,
    },
  );
  if (!res.ok) throw new Error(`upload ${name} failed: ${res.status} ${await res.text()}`);
}

// --- main -----------------------------------------------------------------

const publishedPath = join(ROOT, "dist", "published.json");
const published = existsSync(publishedPath)
  ? JSON.parse(readFileSync(publishedPath, "utf8"))
  : {};

const all = JSON.parse(readFileSync(join(ROOT, "dictionaries.json"), "utf8"));
const slugArg = process.argv.find((a) => a.startsWith("--slug="));
const force = process.argv.includes("--force");
const targets = slugArg ? all.filter((d) => d.slug === slugArg.split("=")[1]) : all;

// `entry` is { repo, revision }. Records written by older versions were a bare
// revision string; those never match, so the dictionary is republished once and
// upgraded to the current shape.
function isCurrent(entry, revision) {
  return (
    entry !== null &&
    typeof entry === "object" &&
    entry.repo === REPO &&
    entry.revision === revision
  );
}

for (const dict of targets) {
  const dir = join(ROOT, "dist", dict.slug);
  const indexPath = join(dir, "index.json");
  const zipPath = join(dir, `weblio-${dict.slug}-dialect-yomitan.zip`);
  if (!existsSync(indexPath) || !existsSync(zipPath)) {
    console.log(`${dict.slug.padEnd(8)} skipped (not built)`);
    continue;
  }
  const index = JSON.parse(readFileSync(indexPath, "utf8"));
  if (!force && isCurrent(published[dict.slug], index.revision)) {
    console.log(`${dict.slug.padEnd(8)} up to date (rev ${index.revision})`);
    continue;
  }

  const release = await ensureRelease(dict.slug);
  await replaceAsset(release, "index.json", readFileSync(indexPath));
  await replaceAsset(release, `weblio-${dict.slug}-dialect-yomitan.zip`, readFileSync(zipPath));
  published[dict.slug] = { repo: REPO, revision: index.revision };
  console.log(`${dict.slug.padEnd(8)} published rev ${index.revision}`);
}

writeFileSync(publishedPath, JSON.stringify(published, null, 2) + "\n");
console.log(`\nwrote dist/published.json (${Object.keys(published).length} dictionaries)`);
