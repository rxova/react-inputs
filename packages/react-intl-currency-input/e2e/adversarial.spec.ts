import { expect, test } from "@playwright/test";

// These tests assert the *focused* editable text is a plain, sanitized number
// (e.g. "1.23") — the point being to verify parsing/sanitization without the
// symbol and grouping in the way. That is formatMode="blur" behaviour, so the
// suite switches the playground field into blur mode first. (currency.spec.ts
// covers the default formatMode="live", where the field stays formatted while
// focused.)
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("format-mode").selectOption("blur");
});

test.describe("locale and parsing boundaries", () => {
  test("honors the Bulgarian minimum-grouping boundary", async ({ page }) => {
    const amount = page.getByTestId("amount");

    await amount.fill("9999");
    await amount.blur();
    await expect(amount).toHaveValue(/9999(?:,00)?\s*€/);

    await amount.fill("10000");
    await amount.blur();
    await expect(amount).toHaveValue(/10[\s\u00a0\u202f]000(?:,00)?\s*€/);
  });

  test("distinguishes an empty field from zero", async ({ page }) => {
    const amount = page.getByTestId("amount");
    await amount.fill("");
    await expect(page.getByTestId("value")).toHaveText("∅ (empty)");
    await amount.blur();
    await expect(amount).toHaveValue("");

    await amount.fill("0");
    await expect(page.getByTestId("value")).toHaveText("0");
    await amount.blur();
    await expect(amount).not.toHaveValue("");
  });

  test("parses a fully formatted German amount pasted into the field", async ({ page }) => {
    await page.getByTestId("locale").selectOption("de-DE");
    const amount = page.getByTestId("amount");
    await amount.fill("1.234,56 €");
    await expect(page.getByTestId("value")).toHaveText("1234.56");
    await amount.blur();
    await expect(amount).toHaveValue(/1\.234,56\s*€/);
  });

  test("parses narrow no-break spaces in a French amount", async ({ page }) => {
    await page.getByTestId("locale").selectOption("fr-FR");
    const amount = page.getByTestId("amount");
    await amount.fill("1\u202f234\u202f567,89 €");
    await expect(page.getByTestId("value")).toHaveText("1234567.89");
    await amount.blur();
    await expect(amount).toHaveValue(/1[\s\u202f]234[\s\u202f]567,89\s*€/);
  });

  test("parses pasted Arabic-Indic digits and separators", async ({ page }) => {
    await page.getByTestId("locale").selectOption("ar-EG");
    const amount = page.getByTestId("amount");
    await amount.fill("١٬٢٣٤٫٥٦ ج.م.");
    await expect(page.getByTestId("value")).toHaveText("1234.56");
    await amount.blur();
    await expect(amount).toHaveValue(/١.*٢٣٤.*٥٦/);
  });

  test("drops symbols, letters, grouping, and repeated decimal points safely", async ({ page }) => {
    await page.getByTestId("locale").selectOption("en-US");
    const amount = page.getByTestId("amount");
    await amount.fill("USD $1,,..2abc3");
    await expect(amount).toHaveValue("1.23");
    await expect(page.getByTestId("value")).toHaveText("1.23");
  });

  test("rejects a negative sign until negative values are enabled", async ({ page }) => {
    await page.getByTestId("locale").selectOption("en-US");
    const amount = page.getByTestId("amount");
    await amount.fill("-12.34");
    await expect(page.getByTestId("value")).toHaveText("12.34");

    await page.getByLabel("Allow negative").check();
    await amount.fill("-12.34");
    await expect(page.getByTestId("value")).toHaveText("-12.34");
    await amount.blur();
    await expect(amount).toHaveValue(/-.*12\.34/);
  });

  test("caps typed fractions to the currency precision", async ({ page }) => {
    await page.getByTestId("locale").selectOption("en-US");
    const amount = page.getByTestId("amount");
    await amount.fill("1.239999");
    await expect(amount).toHaveValue("1.23");
    await expect(page.getByTestId("value")).toHaveText("1.23");
  });

  test("removes fractions while editing a zero-fraction currency", async ({ page }) => {
    await page.getByTestId("locale").selectOption("ja-JP");
    await page.getByTestId("currency").selectOption("JPY");
    const amount = page.getByTestId("amount");
    await amount.fill("123.99");
    await expect(amount).toHaveValue("123");
    await expect(page.getByTestId("value")).toHaveText("123");
  });

  test("preserves a partial locale decimal while focused", async ({ page }) => {
    const amount = page.getByTestId("amount");
    await amount.fill("5,");
    await expect(amount).toHaveValue("5,");
    await expect(page.getByTestId("value")).toHaveText("5");
    await amount.blur();
    await expect(amount).toHaveValue(/5(?:,00)?\s*€/);
  });

  test("handles numeric overflow without exposing Infinity or NaN", async ({ page }) => {
    const amount = page.getByTestId("amount");
    await amount.fill("9".repeat(400));
    await expect(page.getByTestId("value")).toHaveText("∅ (empty)");
    await amount.blur();
    await expect(amount).toHaveValue("");
    await expect(page.locator("body")).not.toContainText(/Infinity|NaN/);
  });
});

test.describe("formatting changes and controlled rerenders", () => {
  test("applies forced trailing zeros without changing the numeric value", async ({ page }) => {
    const amount = page.getByTestId("amount");
    await amount.fill("12.5");
    await amount.blur();
    await page.getByLabel("Min fraction digits").fill("2");
    await expect(amount).toHaveValue(/12,50\s*€/);
    await expect(page.getByTestId("value")).toHaveText("12.5");
  });

  test("switches all currency display modes without corrupting the value", async ({ page }) => {
    const amount = page.getByTestId("amount");
    await page.getByTestId("display").selectOption("code");
    await expect(amount).toHaveValue(/EUR/);
    await page.getByTestId("display").selectOption("name");
    await expect(amount).toHaveValue(/евро/i);
    await expect(page.getByTestId("value")).toHaveText("50000");
  });

  test("updates a focused controlled field from outside React input events", async ({ page }) => {
    const input = page.getByTestId("stress-controlled");
    await input.focus();
    await expect(input).toHaveValue("12.5");
    await page.getByTestId("external-set").click();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("42.5");
    await expect(page.getByTestId("stress-controlled-value")).toHaveText("42.5");
  });

  test("clears a focused controlled field externally", async ({ page }) => {
    const input = page.getByTestId("stress-controlled");
    await input.focus();
    await page.getByTestId("external-clear").click();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("");
    await expect(page.getByTestId("stress-controlled-value")).toHaveText("∅");
  });

  test("re-localizes editable text while the controlled field remains focused", async ({
    page,
  }) => {
    const input = page.getByTestId("stress-controlled");
    await input.fill("1234.5");
    await page.getByTestId("external-locale").click();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("1234,5");
    await expect(page.getByTestId("stress-controlled-value")).toHaveText("1234.5");
  });

  test("reports coherent raw and formatted change metadata", async ({ page }) => {
    const input = page.getByTestId("stress-controlled");
    await input.fill("98.76");
    await expect(page.getByTestId("stress-meta")).toContainText('"value":98.76');
    await expect(page.getByTestId("stress-meta")).toContainText('"raw":"98.76"');
    await expect(page.getByTestId("stress-meta")).toContainText("$98.76");
  });
});

test.describe("keyboard and state-machine abuse", () => {
  test("steps by an exact decimal without floating-point artifacts", async ({ page }) => {
    const input = page.getByTestId("stress-step");
    await input.focus();
    await input.press("ArrowUp");
    await input.press("ArrowUp");
    await input.press("ArrowDown");
    await expect(input).toHaveValue("0.25");
    await expect(page.getByTestId("stress-step-value")).toHaveText("0.25");
  });

  test("does not turn ArrowDown at zero into a positive value", async ({ page }) => {
    const input = page.getByTestId("stress-step");
    await input.focus();
    await input.press("ArrowDown");
    await expect(input).toHaveValue("0");
    await expect(page.getByTestId("stress-step-value")).toHaveText("0");
  });

  test("starts an empty non-negative field at one step or zero by direction", async ({ page }) => {
    const input = page.getByTestId("stress-step");
    await input.fill("");
    await input.press("ArrowUp");
    await expect(input).toHaveValue("0.25");

    await input.fill("");
    await input.press("ArrowDown");
    await expect(input).toHaveValue("0");
  });

  test("allows ArrowDown below zero when negative values are enabled", async ({ page }) => {
    const input = page.getByTestId("stress-negative-step");
    await input.focus();
    await input.press("ArrowDown");
    await expect(input).toHaveValue("-0.25");
    await expect(page.getByTestId("stress-negative-step-value")).toHaveText("-0.25");
  });

  test("leaves modified arrow shortcuts to the browser and application", async ({ page }) => {
    const input = page.getByTestId("stress-step");
    await input.focus();
    await input.press("Shift+ArrowUp");
    await input.press("Control+ArrowUp");
    await input.press("Alt+ArrowDown");
    await expect(input).toHaveValue("0");
    await expect(page.getByTestId("stress-step-value")).toHaveText("0");
  });

  test("applies raw transforms before sanitization", async ({ page }) => {
    const input = page.getByTestId("stress-transform");
    await input.fill("1_234_567.89");
    await expect(input).toHaveValue("1234567.89");
    await expect(page.getByTestId("stress-transform-value")).toHaveText("1234567.89");
  });

  test("keeps uncontrolled edits after blur and refocus", async ({ page }) => {
    const input = page.getByTestId("stress-uncontrolled");
    await input.fill("81.25");
    await input.blur();
    await expect(input).toHaveValue("$81.25");
    await input.focus();
    await expect(input).toHaveValue("81.25");
  });
});

test.describe("form recovery", () => {
  test("replaces a minimum error with a successful numeric submission", async ({ page }) => {
    const form = page.locator('[data-testid="form"]');
    const price = page.getByTestId("form-price");
    await price.fill("0,50");
    await form.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByTestId("form-error")).toHaveText("Must be greater than 0");
    await expect(price).toHaveAttribute("aria-invalid", "true");

    await price.fill("1,01");
    await expect(page.getByTestId("form-error")).not.toBeVisible();
    await form.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByTestId("form-result")).toHaveText("Submitted: 1.01");
    await expect(price).not.toHaveAttribute("aria-invalid", "true");
  });

  test("survives rapid focus, clear, type, and submit transitions", async ({ page }) => {
    const form = page.locator('[data-testid="form"]');
    const price = page.getByTestId("form-price");
    await price.focus();
    await price.fill("");
    await price.fill("9");
    await price.fill("");
    await price.fill("10,25");
    await price.press("Tab");
    await form.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByTestId("form-result")).toHaveText("Submitted: 10.25");
    await expect(page.getByTestId("form-error")).not.toBeVisible();
  });
});
