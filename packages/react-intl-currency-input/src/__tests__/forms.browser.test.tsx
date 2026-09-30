import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Controller, useForm } from "react-hook-form";
import { Formik, Form, useField } from "formik";
import { Field, Form as RFFForm } from "react-final-form";
import { useForm as useTanstackForm } from "@tanstack/react-form";
import { CurrencyInput } from "../CurrencyInput";

/**
 * The whole loop per library: type -> the library's state updates -> submit
 * produces the right *number* -> the field is identifiable for touched/blur.
 * These are the reason `onChange`, `onBlur`, `name` and `invalid` exist.
 */

const typeAmount = async (text: string) => {
  const box = page.getByRole("textbox", { name: "amount" });
  await userEvent.click(box);
  await userEvent.type(box, text);
};

describe("react-hook-form", () => {
  function Harness({ onValid }: { onValid: (v: unknown) => void }) {
    const { control, handleSubmit } = useForm<{ amount: number | null }>({
      defaultValues: { amount: null },
    });
    return (
      <form onSubmit={(e) => void handleSubmit(onValid)(e)}>
        <Controller
          name="amount"
          control={control}
          rules={{ required: "Required", min: { value: 1, message: "Too small" } }}
          render={({ field, fieldState }) => (
            <CurrencyInput
              locale="en-US"
              currency="USD"
              aria-label="amount"
              value={field.value ?? null}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
              invalid={fieldState.invalid}
            />
          )}
        />
        <button type="submit">Send</button>
      </form>
    );
  }

  it("submits the parsed number", async () => {
    const onValid = vi.fn();
    await render(<Harness onValid={onValid} />);
    await typeAmount("50000");
    await userEvent.click(page.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ amount: 50000 }, expect.anything());
    });
  });
});

describe("formik", () => {
  function Amount() {
    const [field, , helpers] = useField<number | null>("amount");
    return (
      <CurrencyInput
        locale="de-DE"
        currency="EUR"
        aria-label="amount"
        value={field.value ?? null}
        onChange={(v) => void helpers.setValue(v)}
        onBlur={field.onBlur}
        name="amount"
      />
    );
  }

  it("submits the parsed number", async () => {
    const onSubmit = vi.fn();
    await render(
      <Formik initialValues={{ amount: null as number | null }} onSubmit={onSubmit}>
        <Form>
          <Amount />
          <button type="submit">Send</button>
        </Form>
      </Formik>,
    );
    await typeAmount("1234,56");
    await userEvent.click(page.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ amount: 1234.56 }, expect.anything());
    });
  });
});

describe("react-final-form", () => {
  it("submits the parsed number", async () => {
    const onSubmit = vi.fn();
    await render(
      <RFFForm
        onSubmit={onSubmit}
        render={({ handleSubmit }) => (
          <form onSubmit={(e) => void handleSubmit(e)}>
            <Field name="amount">
              {({ input }) => (
                <CurrencyInput
                  locale="en-US"
                  currency="USD"
                  aria-label="amount"
                  value={typeof input.value === "number" ? input.value : null}
                  onChange={input.onChange}
                  onBlur={input.onBlur}
                  name={input.name}
                />
              )}
            </Field>
            <button type="submit">Send</button>
          </form>
        )}
      />,
    );
    await typeAmount("50000");
    await userEvent.click(page.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50000 }),
        expect.anything(),
        expect.anything(),
      );
    });
  });
});

describe("tanstack form", () => {
  function Harness({ onValid }: { onValid: (v: { amount: number }) => void }) {
    const form = useTanstackForm({
      defaultValues: { amount: 0 },
      onSubmit: ({ value }) => {
        onValid(value);
      },
    });
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="amount">
          {(field) => (
            <CurrencyInput
              locale="ja-JP"
              currency="JPY"
              aria-label="amount"
              value={field.state.value}
              onChange={(v) => {
                field.handleChange(v ?? 0);
              }}
              onBlur={field.handleBlur}
              name={field.name}
            />
          )}
        </form.Field>
        <button type="submit">Send</button>
      </form>
    );
  }

  it("submits the parsed number", async () => {
    const onValid = vi.fn();
    await render(<Harness onValid={onValid} />);
    await typeAmount("1234");
    await userEvent.click(page.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ amount: 1234 });
    });
  });
});

describe("native form (no library)", () => {
  it("participates under its name (submits the displayed value)", async () => {
    const onSubmit = vi.fn();
    await render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
        }}
      >
        <CurrencyInput
          locale="en-US"
          currency="USD"
          name="amount"
          defaultValue={50000}
          aria-label="amount"
        />
        <button type="submit">Send</button>
      </form>,
    );
    await userEvent.click(page.getByRole("button", { name: "Send" }));
    // v1: the visible field carries `name`, so a plain form posts the formatted
    // display string. Form libraries (above) are the path to the raw number.
    expect(onSubmit).toHaveBeenCalledWith({ amount: "$50,000" });
  });
});
