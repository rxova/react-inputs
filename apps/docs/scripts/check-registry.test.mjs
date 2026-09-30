// The registry is consumed by `shadcn add` from a URL, so nothing in this repo
// exercises it and a broken item fails in someone else's project. These tests
// pin the three ways it breaks quietly — a listed item with no route, a file
// whose content is empty, and a dependency on a package we do not publish.

import { describe, it, beforeEach, afterAll } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkRegistry } from "./check-registry.mjs";

const roots = [];
let root;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "rxova-registry-"));
  roots.push(root);
});
afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
});

const ALLOWED = new Set(["@rxova/react-otp-input"]);

function write(path, body) {
  const full = join(root, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, JSON.stringify(body, null, 2));
}

const entry = (over = {}) => ({
  name: "otp-field",
  type: "registry:component",
  title: "OTP field",
  description: "A field.",
  dependencies: ["@rxova/react-otp-input"],
  ...over,
});

const item = (over = {}) => ({
  ...entry(),
  files: [
    { path: "components/rxova/otp-field.tsx", type: "registry:component", content: "export {}" },
    { path: "components/rxova/otp-field.css", type: "registry:file", content: ".rx-field {}" },
  ],
  ...over,
});

/** A dist with one well-formed item, which is the passing shape. */
function validRegistry(over = {}) {
  write("r/registry.json", { name: "rxova", items: [entry()] });
  write("r/otp-field.json", item(over));
}

const run = () => checkRegistry(root, ALLOWED);

describe("checkRegistry", () => {
  it("passes a registry whose index and routes agree", async () => {
    validRegistry();
    const { failures, items } = await run();

    assert.deepEqual(failures, []);
    assert.equal(items, 1);
  });

  it("reports a build with no registry at all", async () => {
    const { failures } = await run();
    assert.deepEqual(failures, ["no r/ directory in the build"]);
  });

  // A 404 in the middle of someone else's install.
  it("reports an item listed in the index with no route", async () => {
    write("r/registry.json", { name: "rxova", items: [entry(), entry({ name: "ghost-field" })] });
    write("r/otp-field.json", item());

    const { failures } = await run();
    assert.deepEqual(failures, ["ghost-field is in the index but has no r/ghost-field.json"]);
  });

  it("reports a route the index does not list, which nobody can discover", async () => {
    validRegistry();
    write("r/orphan-field.json", item({ name: "orphan-field" }));

    const { failures } = await run();
    assert.deepEqual(failures, ["r/orphan-field.json is not listed in registry.json"]);
  });

  // What a `?raw` import that stopped resolving looks like: the install succeeds
  // and writes an empty component, which is worse than failing outright.
  it("reports a file with no content", async () => {
    validRegistry({
      files: [{ path: "components/rxova/otp-field.tsx", content: "   " }],
    });

    const { failures } = await run();
    assert.deepEqual(failures, ["otp-field file components/rxova/otp-field.tsx has no content"]);
  });

  it("reports an item that ships no files", async () => {
    validRegistry({ files: [] });

    const { failures } = await run();
    assert.deepEqual(failures, ["otp-field ships no files"]);
  });

  // The consumer's install would fail on a typo we could have caught here.
  it("reports a dependency this repo does not publish", async () => {
    write("r/registry.json", { name: "rxova", items: [entry()] });
    write("r/otp-field.json", item({ dependencies: ["@rxova/react-otp-inpt"] }));

    const { failures } = await run();
    assert.deepEqual(failures, [
      'otp-field depends on "@rxova/react-otp-inpt", which this repo does not publish',
    ]);
  });
});
