/**
 * `astro check` and `astro build` both regenerate the TypeDoc output under
 * src/content/docs/components/*\/api, because both load astro.config and the
 * starlight-typedoc plugin generates on load. They are separate turbo tasks
 * writing one directory, so if turbo may run them concurrently the build's link
 * validator can read that directory mid-rewrite and fail on pages that simply
 * have not been written back yet.
 *
 * The failure is a flake, not a break: the page count moves between runs, the
 * reported links differ, and rerunning usually passes. Nothing in the build
 * output says "these two raced", and the obvious reading — that the generated
 * docs are stale or that the build is not idempotent — is wrong, so the trail
 * leads away from the cause. Sequential builds are byte-identical.
 *
 * The ordering that prevents it lives in one line of apps/docs/turbo.json and
 * looks removable: typecheck has no obvious need of a built site. This asserts
 * it is there, so removing it fails here rather than as an intermittent CI red
 * weeks later.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const configPath = fileURLToPath(new URL("../turbo.json", import.meta.url));

/** turbo.json permits comments, which `JSON.parse` does not. */
const readJsonc = (path) =>
  JSON.parse(
    readFileSync(path, "utf8")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, ""),
  );

describe("docs task ordering", () => {
  it("runs typecheck after build, so the two never share the TypeDoc output", () => {
    const config = readJsonc(configPath);

    expect(config.tasks?.typecheck?.dependsOn).toContain("build");
  });

  it("still builds against freshly built dependencies", () => {
    // `^build` is what the root task provides and what typecheck needs for the
    // workspace packages' types. Depending on the local build must not drop it.
    const config = readJsonc(configPath);

    expect(config.tasks?.typecheck?.dependsOn).toContain("^build");
  });
});
