import { expect, test } from "@playwright/test";

/**
 * Full-page flows against the built playground: live formatting while typing, a
 * locale switch, the tricky-locale grid, and a real React Hook Form round-trip
 * with validation. Complements the component-level Vitest browser suite.
 */

test("formats live while typing and stays formatted on focus", async ({ page }) => {
  await page.goto("/");
  const amount = page.getByTestId("amount");

  // Default is bg-BG / EUR / 50000 → grouped with a (non-breaking) space.
  await expect(amount).toHaveValue(/50.000/);

  // Live mode keeps it formatted while focused (no toggle to a plain number).
  await amount.focus();
  await expect(amount).toHaveValue(/50.000/);

  // Retype from scratch — the group separator appears live at 10000.
  await amount.fill("");
  await amount.pressSequentially("123456");
  await expect(amount).toHaveValue(/123.456/);
});

test("re-formats a freshly typed amount on blur", async ({ page }) => {
  await page.goto("/");
  const amount = page.getByTestId("amount");
  await amount.focus();
  await amount.fill("1234.5");
  await expect(page.getByTestId("value")).toHaveText("1234.5");
  await amount.blur();
  // 1234 is below 10000, so bg-BG does NOT group it — and uses a comma decimal.
  // (The "only group above 9999" rule, straight from Intl.)
  await expect(amount).toHaveValue(/1234,5/);
});

test("switching locale and currency changes the formatting", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("locale").selectOption("ja-JP");
  await page.getByTestId("currency").selectOption("JPY");
  const amount = page.getByTestId("amount");
  // JPY has no fraction digits and a comma group separator.
  await expect(amount).toHaveValue(/50,000/);
});

test("the tricky-locale grid renders each field formatted", async ({ page }) => {
  await page.goto("/");
  // hi-IN uses lakh grouping: 12,34,567.89
  const hiIn = page.getByTestId("tricky-hi-IN").getByRole("textbox");
  await expect(hiIn).toHaveValue(/12,34,567/);
});

test("React Hook Form: validation error, then a submitted number", async ({ page }) => {
  await page.goto("/");
  const form = page.locator('[data-testid="form"]');

  await form.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("form-error")).toHaveText("Enter a price");

  await page.getByTestId("form-price").fill("1234,56");
  await form.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByTestId("form-result")).toHaveText(/1234\.56/);
});
