import { describe, expect, it } from "vitest";
import { useState } from "react";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { CurrencyInput } from "../CurrencyInput";

/**
 * `onChange` carries the parsed value; the raw DOM event lives on
 * `onNativeChange`, which chains after the internal handler.
 */

describe("onNativeChange", () => {
  it("receives the DOM event after the internal handler has run", async () => {
    const order: string[] = [];
    function Harness() {
      const [value, setValue] = useState<number | null>(null);
      return (
        <CurrencyInput
          locale="en-US"
          currency="USD"
          value={value}
          onChange={(next) => {
            order.push("value");
            setValue(next);
          }}
          onNativeChange={(event) => {
            order.push("native");
            expect(event.target).toBeInstanceOf(HTMLInputElement);
          }}
          aria-label="amount"
        />
      );
    }
    await render(<Harness />);
    await userEvent.click(page.getByRole("textbox", { name: "amount" }));
    await userEvent.keyboard("4");

    await expect.poll(() => order).toEqual(["value", "native"]);
  });

  it("is optional", async () => {
    function Harness() {
      const [value, setValue] = useState<number | null>(null);
      return (
        <CurrencyInput
          locale="en-US"
          currency="USD"
          value={value}
          onChange={setValue}
          aria-label="amount"
        />
      );
    }
    await render(<Harness />);
    await userEvent.click(page.getByRole("textbox", { name: "amount" }));
    await userEvent.keyboard("99");
    await expect
      .poll(
        () => (page.getByRole("textbox", { name: "amount" }).element() as HTMLInputElement).value,
      )
      .toBe("$99");
  });
});
