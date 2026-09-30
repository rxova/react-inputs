import { describe, expect, it } from "vitest";
import { useState } from "react";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { useCurrencyInput } from "../useCurrencyInput";

/**
 * Most of the hook is exercised through <CurrencyInput>; this file covers the
 * imperative `setValue` path (form resets) and the exposed helpers directly.
 */

function Harness({
  controlled = false,
  formatMode,
}: {
  controlled?: boolean;
  formatMode?: "live" | "blur";
}) {
  const [v, setV] = useState<number | null>(null);
  const cur = useCurrencyInput(
    controlled
      ? { locale: "en-US", currency: "USD", value: v, onChange: setV, formatMode }
      : { locale: "en-US", currency: "USD", defaultValue: null, formatMode },
  );
  return (
    <>
      <input {...cur.inputProps} aria-label="amount" />
      {/* preventDefault on mousedown keeps the input focused across the click */}
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onClick={() => {
          cur.setValue(500);
        }}
      >
        set 500
      </button>
      <span data-testid="value">{String(cur.value)}</span>
      <span data-testid="dec">{cur.decimalSeparator}</span>
      <span data-testid="sym">{cur.currencySymbol}</span>
    </>
  );
}

const inputEl = () => page.getByRole("textbox", { name: "amount" }).element() as HTMLInputElement;

describe("setValue (imperative)", () => {
  it("updates an uncontrolled value and formats it while idle", async () => {
    await render(<Harness />);
    await userEvent.click(page.getByRole("button", { name: "set 500" }));
    await expect.poll(() => inputEl().value).toBe("$500");
    await expect.poll(() => page.getByTestId("value").element().textContent).toBe("500");
  });

  it("updates the displayed text when called while focused", async () => {
    await render(<Harness />);
    await userEvent.click(page.getByRole("textbox", { name: "amount" }));
    await userEvent.click(page.getByRole("button", { name: "set 500" }));
    // Live mode (the default) keeps the field formatted while focused.
    await expect.poll(() => inputEl().value).toBe("$500");
  });

  it("shows a plain number while focused in blur mode", async () => {
    await render(<Harness formatMode="blur" />);
    await userEvent.click(page.getByRole("textbox", { name: "amount" }));
    await userEvent.click(page.getByRole("button", { name: "set 500" }));
    await expect.poll(() => inputEl().value).toBe("500");
  });

  it("is a no-op on the value in controlled mode", async () => {
    await render(<Harness controlled />);
    await userEvent.click(page.getByRole("button", { name: "set 500" }));
    // Controlled: setValue does not call onChange, so the parent value
    // stays null and the field stays empty.
    await expect.poll(() => page.getByTestId("value").element().textContent).toBe("null");
  });
});

describe("headless live typing without the ref attached", () => {
  function LiveHeadless() {
    const [v, setV] = useState<number | null>(null);
    // Deliberately does NOT attach cur.ref, so caret placement must no-op.
    const cur = useCurrencyInput({
      locale: "en-US",
      currency: "USD",
      value: v,
      onChange: setV,
    });
    return (
      <>
        <input {...cur.inputProps} aria-label="amount" />
        <span data-testid="value">{String(cur.value)}</span>
      </>
    );
  }

  it("still formats and parses even though the caret cannot be managed", async () => {
    await render(<LiveHeadless />);
    await userEvent.click(page.getByRole("textbox", { name: "amount" }));
    await userEvent.type(page.getByRole("textbox", { name: "amount" }), "1234");
    await expect.poll(() => inputEl().value).toBe("$1,234");
    await expect.poll(() => page.getByTestId("value").element().textContent).toBe("1234");
  });
});

describe("exposed helpers", () => {
  it("reports the locale separators and symbol", async () => {
    await render(<Harness />);
    await expect.poll(() => page.getByTestId("dec").element().textContent).toBe(".");
    await expect.poll(() => page.getByTestId("sym").element().textContent).toBe("$");
  });
});
