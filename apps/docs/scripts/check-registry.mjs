#!/usr/bin/env node
// Verify the emitted component registry.
//
// Usage: node ./scripts/check-registry.mjs [distDir]
//
// The registry is consumed by `shadcn add` from a URL, which means nothing in
// this repo ever exercises it and a broken item fails in someone else's project
// rather than in our build. The specific ways it can break quietly:
//
//   - an item listed in the index with no route emitted for it (a 404 mid-install)
//   - a file whose `content` is empty, which is what a `?raw` import that stopped
//     resolving looks like — the install "succeeds" and writes an empty component
//   - a `dependencies` entry naming a package this repo does not publish, so the
//     consumer's install fails on a typo we could have caught here
//
// Reads `dist`, so it checks what is actually served rather than what the source
// intends.

import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { componentPackages } from "../../../scripts/component-packages.mjs";

const docsRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export const DEFAULT_DIST = join(docsRoot, "dist");

/** Package names this repo publishes, which is what an item may depend on. */
export function publishedNames(repoRoot = join(docsRoot, "../..")) {
  return new Set(componentPackages(repoRoot).map((component) => component.name));
}

export async function checkRegistry(distDir = DEFAULT_DIST, allowed = publishedNames()) {
  const failures = [];
  const dir = join(distDir, "r");

  const files = await readdir(dir).catch(() => null);
  if (files === null) return { failures: ["no r/ directory in the build"], items: 0 };

  const index = JSON.parse(await readFile(join(dir, "registry.json"), "utf8"));
  const routes = new Set(files.filter((f) => f.endsWith(".json") && f !== "registry.json"));

  for (const entry of index.items ?? []) {
    if (!routes.has(`${entry.name}.json`)) {
      failures.push(`${entry.name} is in the index but has no r/${entry.name}.json`);
      continue;
    }
    routes.delete(`${entry.name}.json`);

    const item = JSON.parse(await readFile(join(dir, `${entry.name}.json`), "utf8"));

    for (const dependency of item.dependencies ?? []) {
      if (!allowed.has(dependency)) {
        failures.push(`${entry.name} depends on "${dependency}", which this repo does not publish`);
      }
    }

    if (!item.files?.length) failures.push(`${entry.name} ships no files`);
    for (const file of item.files ?? []) {
      // An empty body is what a `?raw` import that stopped resolving looks like:
      // the install succeeds and writes nothing, which is worse than failing.
      if (!file.content?.trim()) failures.push(`${entry.name} file ${file.path} has no content`);
    }
  }

  // A route nobody can discover is dead weight the index should have listed.
  for (const orphan of routes) failures.push(`r/${orphan} is not listed in registry.json`);

  return { failures, items: (index.items ?? []).length };
}

// Only run as a CLI; the tests import the functions above.
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [, , dist = DEFAULT_DIST] = process.argv;
  const { failures, items } = await checkRegistry(dist);

  if (failures.length > 0) {
    console.error(
      `${failures.length} registry problem(s):\n${failures.map((f) => `  ✗ ${f}`).join("\n")}`,
    );
    process.exit(1);
  }
  console.log(`✔ ${items} registry item(s), each with a route and real content`);
}
