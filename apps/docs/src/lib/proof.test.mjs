import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { componentPackages } from "../../../../scripts/component-packages.mjs";
import {
  axeTags,
  coverageFloor,
  e2eBrowsers,
  packageBudgets,
  repoRoot,
  suiteBudget,
} from "./proof.mjs";

/**
 * The landing page sells this library on numbers, so the numbers have to be
 * true. proof.mjs reads them from the configs CI enforces rather than from a
 * hand-written list, which rules out drift by construction — what remains is
 * the failure mode that ruling-out cannot catch: a reader that finds nothing
 * and returns nothing, leaving the page silently incomplete while the build
 * stays green.
 *
 * So these tests are mostly vacuity checks. They assert the readers came back
 * with something, that what they came back with covers every component package,
 * and that the claims the page makes still hold. A config someone restructures
 * fails here rather than on the published page.
 */
describe("proof", () => {
  const packages = componentPackages(repoRoot);

  it("discovers the component packages it reports on", () => {
    // Everything below is per-package; if the registry itself came back empty,
    // every other assertion in this file would pass by doing nothing.
    expect(packages.length).toBeGreaterThan(0);
  });

  describe("size budgets", () => {
    it("reports the whole-suite and tree-shaken ceilings in Brotli", () => {
      const { wholeKb, singleKb, compression } = suiteBudget();

      expect(wholeKb).toBeGreaterThan(0);
      expect(singleKb).toBeGreaterThan(0);
      // Taking one component cannot cost more than taking all of them; if it
      // does, one of the two entries was matched wrongly.
      expect(singleKb).toBeLessThanOrEqual(wholeKb);
      // size-limit's small-lib preset measures Brotli. The page says Brotli
      // because saying gzip would overstate the win.
      expect(compression).toBe("Brotli");
    });

    it("reports a budget for every component package", () => {
      const budgets = packageBudgets();

      // Deliberately not "the budgets equal what .size-limit.json says" — that
      // reads the same file the implementation reads, so it passes no matter
      // what either one contains. The invariant worth pinning is the suite's
      // own convention: every input ships a component and a headless hook, and
      // both carry a budget. Deleting one fails here.
      for (const { dir, label } of packages) {
        const rows = budgets.filter((budget) => budget.dir === dir);

        expect(
          rows.map((row) => row.import),
          `${label} (packages/${dir})`,
        ).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/^\{ [A-Z]/), // the component
            expect.stringMatching(/^\{ use[A-Z]/), // the headless hook
          ]),
        );
        expect(rows.every((row) => row.limitKb > 0)).toBe(true);
      }
    });
  });

  describe("coverage floor", () => {
    it("is enforced per file, so a thin module cannot hide in the aggregate", () => {
      expect(coverageFloor().perFile).toBe(true);
    });

    it("holds the 95% line the page claims", () => {
      const floor = coverageFloor();

      // The page claims "95% enforced per file". These three are 95 across the
      // suite; branches is deliberately 90 on react-otp-input alone, whose
      // defensive DOM/SSR guards cannot be exercised — and because the floor is
      // the minimum across packages, that is the number reported here. The page
      // must not round it up.
      expect(floor.statements).toBeGreaterThanOrEqual(95);
      expect(floor.functions).toBeGreaterThanOrEqual(95);
      expect(floor.lines).toBeGreaterThanOrEqual(95);
      expect(floor.branches).toBeGreaterThanOrEqual(90);
    });
  });

  it("runs E2E on every engine the page names", () => {
    // The intersection across packages, so this only passes while *every*
    // component is tested on all three.
    expect(e2eBrowsers().toSorted()).toEqual(["chromium", "firefox", "webkit"]);
  });

  it("scans against the full WCAG 2.1 A/AA tag set", () => {
    expect(axeTags().toSorted()).toEqual(["wcag21a", "wcag21aa", "wcag2a", "wcag2aa"].toSorted());
  });

  it("leaves no size claim hardcoded in the landing page prose", () => {
    const mdx = readFileSync(
      join(repoRoot, "apps", "docs", "src", "content", "docs", "index.mdx"),
      "utf8",
    );
    // Fenced examples are illustrative code, not claims, so they are exempt.
    const prose = mdx.replace(/```[\s\S]*?```/g, "");

    // A number typed into the prose bypasses proof.mjs entirely, which is the
    // whole point of proof.mjs. Anything measured belongs in a prop.
    expect(prose).not.toMatch(/\d\s*kB/i);
  });
});
