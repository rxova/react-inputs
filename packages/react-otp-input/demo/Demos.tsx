import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Formik, Form as FormikForm, useField } from "formik";
import { Field as FinalField, Form as FinalForm } from "react-final-form";
import { useForm as useTanstackForm } from "@tanstack/react-form";
import { OtpInput, OtpGroup, OtpSlot, OtpSeparator } from "@rxova/react-otp-input";
import { Section } from "@rxova/demo-kit";

/**
 * Every scenario the E2E suite drives, and the manual QA surface.
 *
 * Each block carries a `data-testid` so specs target intent rather than DOM
 * shape. Anything added here should be something worth checking in a real
 * page: full-page tab order, a genuine form round-trip, page-level RTL, and the
 * things a single mounted component can't show.
 */

function DefaultDemo() {
  const [code, setCode] = useState("");
  const [completed, setCompleted] = useState<string | null>(null);
  return (
    <>
      <OtpInput
        length={6}
        value={code}
        onChange={setCode}
        onComplete={setCompleted}
        label="One-time code"
      />
      <p>
        value: <output data-testid="default-value">{code || "empty"}</output> · complete:{" "}
        <output data-testid="default-complete">{completed ?? "no"}</output>
      </p>
    </>
  );
}

function GroupedDemo() {
  const [code, setCode] = useState("");
  return (
    <OtpInput length={6} value={code} onChange={setCode} label="Grouped code">
      <OtpGroup>
        <OtpSlot index={0} />
        <OtpSlot index={1} />
        <OtpSlot index={2} />
      </OtpGroup>
      <OtpSeparator>–</OtpSeparator>
      <OtpGroup>
        <OtpSlot index={3} />
        <OtpSlot index={4} />
        <OtpSlot index={5} />
      </OtpGroup>
    </OtpInput>
  );
}

function AlphanumericDemo() {
  const [code, setCode] = useState("");
  return (
    <>
      <OtpInput
        length={6}
        value={code}
        onChange={setCode}
        mode="alphanumeric"
        transform={(s) => s.toUpperCase()}
        label="Alphanumeric code"
      />
      <p>
        value: <output data-testid="alphanumeric-value">{code || "empty"}</output>
      </p>
    </>
  );
}

function RenderPropDemo() {
  const [code, setCode] = useState("");
  return (
    <OtpInput
      length={4}
      value={code}
      onChange={setCode}
      label="Custom render"
      render={({ slots }) => (
        <div style={{ display: "inline-flex", gap: "0.5rem" }}>
          {slots.map((slot) => (
            <span
              key={slot.index}
              data-cell={slot.index}
              style={{
                fontFamily: "ui-monospace, monospace",
                borderBottom: "2px solid currentColor",
                minWidth: "1.5rem",
                textAlign: "center",
              }}
            >
              {slot.char ?? "·"}
            </span>
          ))}
        </div>
      )}
    />
  );
}

function NativeFormDemo() {
  const [submitted, setSubmitted] = useState<string | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))));
      }}
    >
      <OtpInput name="code" length={6} label="Code" />
      <button type="submit">Submit</button>
      <output data-testid="native-form-result">{submitted ?? "not submitted"}</output>
    </form>
  );
}

function HookFormDemo() {
  const { control, handleSubmit } = useForm<{ code: string }>({ defaultValues: { code: "" } });
  const [result, setResult] = useState<string | null>(null);
  return (
    <form
      onSubmit={(e) => {
        void handleSubmit((values) => {
          setResult(JSON.stringify(values));
        })(e);
      }}
    >
      <Controller
        name="code"
        control={control}
        rules={{ minLength: { value: 6, message: "Enter all six digits" } }}
        render={({ field, fieldState }) => (
          <>
            <OtpInput
              length={6}
              label="Verification code"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              invalid={fieldState.invalid}
              aria-describedby={fieldState.error ? "rhf-error" : undefined}
            />
            {fieldState.error && (
              <p id="rhf-error" role="alert" className="error">
                {fieldState.error.message}
              </p>
            )}
          </>
        )}
      />
      <button type="submit">Verify</button>
      <output data-testid="rhf-result">{result ?? "not submitted"}</output>
    </form>
  );
}

function FormikField() {
  const [field, meta, helpers] = useField<string>("code");
  return (
    <>
      <OtpInput
        length={6}
        label="One-time code"
        name="code"
        value={field.value}
        onChange={(value) => void helpers.setValue(value)}
        onBlur={() => void helpers.setTouched(true)}
        invalid={Boolean(meta.touched && meta.error)}
        aria-describedby={meta.touched && meta.error ? "formik-error" : undefined}
      />
      {meta.touched && meta.error && (
        <p id="formik-error" role="alert" className="error">
          {meta.error}
        </p>
      )}
    </>
  );
}

function FormikDemo() {
  const [result, setResult] = useState<string | null>(null);
  return (
    <Formik
      initialValues={{ code: "" }}
      validate={(v) => (v.code.length === 6 ? {} : { code: "Enter all six digits" })}
      onSubmit={(values) => {
        setResult(JSON.stringify(values));
      }}
    >
      <FormikForm>
        <FormikField />
        <button type="submit">Verify</button>
        <output data-testid="formik-result">{result ?? "not submitted"}</output>
      </FormikForm>
    </Formik>
  );
}

function FinalFormDemo() {
  const [result, setResult] = useState<string | null>(null);
  return (
    <FinalForm
      onSubmit={(values: { code?: string }) => {
        setResult(JSON.stringify(values));
      }}
      validate={(v: { code?: string }) =>
        (v.code ?? "").length === 6 ? {} : { code: "Enter all six digits" }
      }
      render={({ handleSubmit }) => (
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <FinalField name="code">
            {({ input: field, meta }) => (
              // RFF starts the field as '', already a valid empty code.
              <OtpInput
                length={6}
                label="One-time code"
                name={field.name}
                value={String(field.value)}
                onChange={field.onChange}
                onBlur={field.onBlur}
                invalid={Boolean(meta.touched && meta.error)}
                aria-describedby={meta.touched && meta.error ? "rff-error" : undefined}
              />
            )}
          </FinalField>
          <button type="submit">Verify</button>
          <output data-testid="rff-result">{result ?? "not submitted"}</output>
        </form>
      )}
    />
  );
}

function TanstackFormDemo() {
  const [result, setResult] = useState<string | null>(null);
  const form = useTanstackForm({
    defaultValues: { code: "" },
    onSubmit: ({ value }) => {
      setResult(JSON.stringify(value));
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
        name="code"
        validators={{
          onChange: ({ value }) => (value.length === 6 ? undefined : "Enter all six digits"),
        }}
      >
        {(field) => (
          <>
            <OtpInput
              length={6}
              label="One-time code"
              name="code"
              value={field.state.value}
              onChange={(value) => {
                field.handleChange(value);
              }}
              onBlur={field.handleBlur}
              invalid={!field.state.meta.isValid}
              aria-describedby={field.state.meta.isValid ? undefined : "tanstack-error"}
            />
            {!field.state.meta.isValid && (
              <p id="tanstack-error" role="alert" className="error">
                {field.state.meta.errors.join(", ")}
              </p>
            )}
          </>
        )}
      </form.Field>
      <button type="submit">Verify</button>
      <output data-testid="tanstack-result">{result ?? "not submitted"}</output>
    </form>
  );
}

export function OtpDemos({ dir = "ltr" }: { dir?: "ltr" | "rtl" }) {
  return (
    <main dir={dir}>
      <div className="grid">
        <Section id="default" title="Default" note="6 numeric slots, tap-to-edit">
          <DefaultDemo />
        </Section>

        <Section id="grouped" title="Grouped" note="compound 123–456">
          <GroupedDemo />
        </Section>

        <Section id="alphanumeric" title="Alphanumeric" note="uppercase transform">
          <AlphanumericDemo />
        </Section>

        <Section id="masked" title="Masked" note="mask, value 1234">
          <OtpInput length={4} defaultValue="1234" mask label="PIN" />
        </Section>

        <Section id="placeholder" title="Placeholder" note="· on empty slots">
          <OtpInput length={4} placeholder="·" label="Code with placeholder" />
        </Section>

        <Section id="render-prop" title="Render prop" note="fully custom cells">
          <RenderPropDemo />
        </Section>

        <Section id="invalid" title="Invalid" note="aria-invalid + data-invalid">
          <OtpInput length={6} defaultValue="12" invalid aria-describedby="inv-help" label="Code" />
          <p id="inv-help" className="error">
            That code has expired
          </p>
        </Section>

        <Section id="disabled" title="Disabled" note="exposed, not editable">
          <OtpInput length={6} defaultValue="123" disabled label="Disabled code" />
        </Section>

        <Section id="readonly" title="Read only" note="value shown, not editable">
          <OtpInput length={6} defaultValue="482913" readOnly label="Read-only code" />
        </Section>

        <Section id="crush" title="Crush mode" note="input-otp-style layout">
          <OtpInput length={6} label="Crush code" slotInteraction="crush" />
        </Section>

        <Section id="native-form" title="Native form" note="posts via name, no library">
          <NativeFormDemo />
        </Section>

        <Section id="hook-form" title="React Hook Form" note="Controller + validation">
          <HookFormDemo />
        </Section>

        <Section id="formik" title="Formik" note="useField + validation">
          <FormikDemo />
        </Section>

        <Section id="final-form" title="React Final Form" note="Field + validation">
          <FinalFormDemo />
        </Section>

        <Section id="tanstack-form" title="TanStack Form" note="form.Field + validation">
          <TanstackFormDemo />
        </Section>
      </div>
    </main>
  );
}

// See the note in the currency demo: the playground resolves the default.
export default OtpDemos;
