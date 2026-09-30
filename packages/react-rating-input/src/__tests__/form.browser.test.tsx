import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Controller, useForm } from "react-hook-form";
import { useField, Formik, Form } from "formik";
import { Field, Form as RFFForm } from "react-final-form";
import { useForm as useTanstackForm } from "@tanstack/react-form";
import { Rating } from "../Rating";

/**
 * These assert the whole loop for each library: interact -> library state
 * updates -> submit produces the right payload -> validation renders. They are
 * the reason `onBlur`, `invalid` and `aria-describedby` exist as props.
 */

describe("native form, no library", () => {
  it("submits the value under its name", async () => {
    const onSubmit = vi.fn();
    await render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
        }}
      >
        <Rating name="score" defaultValue={0} onChange={() => undefined} precision={1} />
        <button type="submit">Send</button>
      </form>,
    );
    await page.getByRole("radio", { name: "4 of 5" }).click();
    await page.getByRole("button", { name: "Send" }).click();
    expect(onSubmit).toHaveBeenCalledWith({ score: "4" });
  });
});

describe("react-hook-form", () => {
  function RhfHarness({ onValid }: { onValid: (v: unknown) => void }) {
    const { control, handleSubmit } = useForm<{ rating: number }>({
      defaultValues: { rating: 0 },
    });
    return (
      <form
        onSubmit={(e) => {
          void handleSubmit(onValid)(e);
        }}
      >
        <Controller
          name="rating"
          control={control}
          rules={{ min: { value: 1, message: "Please rate" } }}
          render={({ field, fieldState }) => (
            <>
              <Rating
                {...field}
                precision={0.5}
                invalid={fieldState.invalid}
                aria-describedby={fieldState.error ? "rating-err" : undefined}
              />
              {fieldState.error && <p id="rating-err">{fieldState.error.message}</p>}
            </>
          )}
        />
        <button type="submit">Send</button>
      </form>
    );
  }

  it("spreads {...field} and submits the selected value", async () => {
    const onValid = vi.fn();
    await render(<RhfHarness onValid={onValid} />);
    await page.getByRole("radio", { name: "3.5 of 5" }).click();
    await page.getByRole("button", { name: "Send" }).click();
    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith(
        expect.objectContaining({ rating: 3.5 }),
        expect.anything(),
      );
    });
  });

  it("surfaces a validation error and links it to the group", async () => {
    await render(<RhfHarness onValid={vi.fn()} />);
    await page.getByRole("button", { name: "Send" }).click();
    await expect.element(page.getByText("Please rate")).toBeInTheDocument();
    await expect
      .element(page.getByRole("radiogroup"))
      .toHaveAttribute("aria-describedby", "rating-err");
    await expect.element(page.getByRole("radiogroup")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("formik", () => {
  function FormikRating() {
    const [field, meta, helpers] = useField<number>("rating");
    return (
      <Rating
        name="rating"
        value={field.value}
        onChange={(v) => {
          void helpers.setValue(v);
        }}
        onBlur={field.onBlur}
        precision={1}
        invalid={meta.touched && Boolean(meta.error)}
      />
    );
  }

  it("updates formik state and submits", async () => {
    const onSubmit = vi.fn();
    await render(
      <Formik initialValues={{ rating: 0 }} onSubmit={onSubmit}>
        <Form>
          <FormikRating />
          <button type="submit">Send</button>
        </Form>
      </Formik>,
    );
    await page.getByRole("radio", { name: "2 of 5" }).click();
    await page.getByRole("button", { name: "Send" }).click();
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ rating: 2 }),
        expect.anything(),
      );
    });
  });

  it("marks touched only after focus leaves the group", async () => {
    const touchedLog: boolean[] = [];
    function Probe() {
      const [, meta] = useField<number>("rating");
      touchedLog.push(meta.touched);
      return null;
    }
    await render(
      <Formik initialValues={{ rating: 0 }} onSubmit={vi.fn()}>
        <Form>
          <FormikRating />
          <Probe />
          <button type="submit">Send</button>
        </Form>
      </Formik>,
    );

    // Arrowing between icons moves focus between sibling radios. If blur were
    // wired per-input, this would mark the field touched mid-interaction and
    // fire validation while the user is still choosing.
    await page.getByRole("radio", { name: "2 of 5" }).click();
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{ArrowRight}");
    expect(touchedLog.at(-1)).toBe(false);

    await page.getByRole("button", { name: "Send" }).click();
    await vi.waitFor(() => {
      expect(touchedLog.at(-1)).toBe(true);
    });
  });
});

describe("react-final-form", () => {
  it("handles the empty-string initial value and submits a number", async () => {
    const onSubmit = vi.fn();
    await render(
      <RFFForm
        onSubmit={onSubmit}
        render={({ handleSubmit }) => (
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
          >
            <Field name="rating">
              {({ input, meta }) => (
                <Rating
                  // RFF represents an empty field as '', which is not a number.
                  value={typeof input.value === "number" ? input.value : 0}
                  onChange={input.onChange}
                  onBlur={input.onBlur}
                  precision={1}
                  invalid={meta.touched === true && Boolean(meta.error)}
                />
              )}
            </Field>
            <button type="submit">Send</button>
          </form>
        )}
      />,
    );
    await page.getByRole("radio", { name: "5 of 5" }).click();
    await page.getByRole("button", { name: "Send" }).click();
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ rating: 5 }),
        expect.anything(),
        expect.anything(),
      );
    });
  });
});

describe("tanstack form", () => {
  function TanstackHarness({ onValid }: { onValid: (v: { rating: number }) => void }) {
    const form = useTanstackForm({
      defaultValues: { rating: 0 },
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
        <form.Field
          name="rating"
          validators={{ onChange: ({ value }) => (value < 1 ? "Please rate" : undefined) }}
        >
          {(field) => (
            <>
              <Rating
                name="rating"
                value={field.state.value}
                onChange={(v) => {
                  field.handleChange(v);
                }}
                onBlur={field.handleBlur}
                precision={0.5}
                invalid={!field.state.meta.isValid}
                aria-describedby={field.state.meta.isValid ? undefined : "rating-err"}
              />
              {!field.state.meta.isValid && (
                <p id="rating-err">{field.state.meta.errors.join(", ")}</p>
              )}
            </>
          )}
        </form.Field>
        <button type="submit">Send</button>
      </form>
    );
  }

  it("drives tanstack state and submits the selected value", async () => {
    const onValid = vi.fn();
    await render(<TanstackHarness onValid={onValid} />);
    await page.getByRole("radio", { name: "3.5 of 5" }).click();
    await page.getByRole("button", { name: "Send" }).click();
    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ rating: 3.5 });
    });
  });

  it("surfaces a validation error and links it to the group", async () => {
    await render(<TanstackHarness onValid={vi.fn()} />);
    await page.getByRole("button", { name: "Send" }).click();
    await expect.element(page.getByText("Please rate")).toBeInTheDocument();
    await expect
      .element(page.getByRole("radiogroup"))
      .toHaveAttribute("aria-describedby", "rating-err");
    await expect.element(page.getByRole("radiogroup")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("group blur", () => {
  it("fires once when focus leaves, not while moving between icons", async () => {
    const onBlur = vi.fn();
    await render(
      <>
        <Rating defaultValue={2} onChange={() => undefined} onBlur={onBlur} precision={1} />
        <button type="button">after</button>
      </>,
    );
    await page.getByRole("radio", { name: "2 of 5" }).click();
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard("{ArrowRight}");
    expect(onBlur).not.toHaveBeenCalled();

    await page.getByRole("button", { name: "after" }).click();
    await vi.waitFor(() => {
      expect(onBlur).toHaveBeenCalledTimes(1);
    });
  });

  it("forwards a blur event whose target carries the field name", async () => {
    // Formik's handleBlur reads event.target.name to identify the field.
    const onBlur = vi.fn();
    await render(
      <>
        <Rating
          name="rating"
          defaultValue={1}
          onChange={() => undefined}
          onBlur={onBlur}
          precision={1}
        />
        <button type="button">after</button>
      </>,
    );
    await page.getByRole("radio", { name: "1 of 5" }).click();
    await page.getByRole("button", { name: "after" }).click();
    await vi.waitFor(() => {
      expect(onBlur).toHaveBeenCalled();
    });
    const event = onBlur.mock.calls[0]![0] as { target: HTMLInputElement };
    expect(event.target.name).toBe("rating");
  });
});
