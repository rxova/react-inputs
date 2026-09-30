import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/**
 * Scans the whole document rather than one mounted component, so it also
 * catches problems that only exist in composition — duplicate ids across
 * several fields, orphaned aria-describedby targets, landmark structure.
 */
async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations.map((v) => `${v.id} (${String(v.nodes.length)}): ${v.help}`);
}

test("the whole playground is free of WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Currency input" })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test("stays clean while showing a validation error", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-testid="form"]').getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("form-error")).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test("the invalid field is marked for assistive tech", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-testid="form"]').getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("form-price")).toHaveAttribute("aria-invalid", "true");
});
