import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { Controller, useForm } from "react-hook-form";
import { Form, Formik, useField } from "formik";
import { Field as FinalField, Form as FinalForm } from "react-final-form";
import { useForm as useTanstackForm } from "@tanstack/react-form";
import { OtpInput } from "../OtpInput";

function input(): HTMLInputElement {
  return page.getByRole("textbox").element() as HTMLInputElement;
}

/**
 * The whole loop for each integration: interact -> library state updates ->
 * submit produces the right payload. These are why `onChange` emits a string,
 * `name` posts natively, and `onBlur`/`invalid` exist.
 */

describe("native form, no library", () => {
  it("submits the code as a single field under its name", async () => {
    const onSubmit = vi.fn();
    await render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(Object.fromEntries(new FormData(e.currentTarget)));
        }}
      >
        <OtpInput name="code" length={4} label="Code" />
        <button type="submit">Send</button>
      </form>,
    );
    await input().focus();
    await userEvent.keyboard("1234");
    await page.getByRole("button", { name: "Send" }).click();
    expect(onSubmit).toHaveBeenCalledWith({ code: "1234" });
  });
});

describe("react-hook-form via Controller", () => {
  function Harness({ onValid }: { onValid: (v: unknown) => void }) {
    const { control, handleSubmit } = useForm<{ code: string }>({ defaultValues: { code: "" } });
    return (
      <form
        onSubmit={(e) => {
          void handleSubmit(onValid)(e);
        }}
      >
        <Controller
          name="code"
          control={control}
          render={({ field }) => (
            <OtpInput
              length={4}
              label="Code"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
            />
          )}
        />
        <button type="submit">Send</button>
      </form>
    );
  }

  it("binds the value and submits it", async () => {
    const onValid = vi.fn();
    await render(<Harness onValid={onValid} />);
    await input().focus();
    await userEvent.keyboard("4821");
    await page.getByRole("button", { name: "Send" }).click();
    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ code: "4821" }, expect.anything());
    });
  });
});

describe("formik via useField", () => {
  function Field() {
    const [field, , helpers] = useField<string>("code");
    return (
      <OtpInput
        length={4}
        label="Code"
        name="code"
        value={field.value}
        onChange={(v) => void helpers.setValue(v)}
        onBlur={() => void helpers.setTouched(true)}
      />
    );
  }

  it("drives Formik state and submits the value", async () => {
    const onSubmit = vi.fn();
    await render(
      <Formik initialValues={{ code: "" }} onSubmit={(values) => onSubmit(values)}>
        <Form>
          <Field />
          <button type="submit">Send</button>
        </Form>
      </Formik>,
    );
    await input().focus();
    await userEvent.keyboard("7391");
    await page.getByRole("button", { name: "Send" }).click();
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ code: "7391" });
    });
  });
});

describe("react-final-form via Field", () => {
  it("binds the empty-string field and submits the code", async () => {
    const onSubmit = vi.fn();
    await render(
      <FinalForm
        onSubmit={(values) => {
          onSubmit(values);
        }}
        render={({ handleSubmit }) => (
          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
          >
            <FinalField name="code">
              {({ input: fieldInput }) => (
                // RFF starts the field as '', already a valid empty code — no guard needed.
                <OtpInput
                  length={4}
                  label="Code"
                  name={fieldInput.name}
                  value={String(fieldInput.value)}
                  onChange={fieldInput.onChange}
                  onBlur={fieldInput.onBlur}
                />
              )}
            </FinalField>
            <button type="submit">Send</button>
          </form>
        )}
      />,
    );
    await input().focus();
    await userEvent.keyboard("5063");
    await page.getByRole("button", { name: "Send" }).click();
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ code: "5063" });
    });
  });
});

describe("TanStack Form via form.Field", () => {
  function Harness({ onValid }: { onValid: (v: unknown) => void }) {
    const form = useTanstackForm({
      defaultValues: { code: "" },
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
        <form.Field name="code">
          {(field) => (
            <OtpInput
              length={4}
              label="Code"
              name="code"
              value={field.state.value}
              onChange={(value) => {
                field.handleChange(value);
              }}
              onBlur={field.handleBlur}
            />
          )}
        </form.Field>
        <button type="submit">Send</button>
      </form>
    );
  }

  it("binds the value and submits it", async () => {
    const onValid = vi.fn();
    await render(<Harness onValid={onValid} />);
    await input().focus();
    await userEvent.keyboard("8241");
    await page.getByRole("button", { name: "Send" }).click();
    await vi.waitFor(() => {
      expect(onValid).toHaveBeenCalledWith({ code: "8241" });
    });
  });
});
