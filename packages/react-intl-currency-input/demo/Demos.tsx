import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { CurrencyInput, currencyForCountry } from "@rxova/react-intl-currency-input";
import type { CurrencyDisplay, CurrencyInputChange } from "@rxova/react-intl-currency-input";
import { Section } from "@rxova/demo-kit";

/**
 * The manual QA surface and the page the E2E suite drives. Each block carries a
 * `data-testid` so specs target intent rather than DOM shape.
 */

const LOCALES = ["bg-BG", "de-DE", "fr-FR", "en-US", "en-IN", "hi-IN", "ja-JP", "ar-EG", "de-CH"];
const CURRENCIES = ["EUR", "BGN", "USD", "GBP", "JPY", "INR", "EGP", "CHF", "KWD"];

function Playground() {
  const [locale, setLocale] = useState("bg-BG");
  const [currency, setCurrency] = useState("EUR");
  const [display, setDisplay] = useState<CurrencyDisplay>("symbol");
  const [allowNegative, setAllowNegative] = useState(false);
  const [minFraction, setMinFraction] = useState(0);
  const [formatMode, setFormatMode] = useState<"live" | "blur">("live");
  const [value, setValue] = useState<number | null>(50000);

  return (
    <Section
      id="playground"
      title="Interactive"
      note="Change the locale and currency and watch formatting follow. The field formats as you type — grouping and the symbol stay visible and the caret stays put."
    >
      <div className="controls">
        <label>
          Locale
          <select
            data-testid="locale"
            value={locale}
            onChange={(e) => {
              setLocale(e.target.value);
              const guessed = currencyForCountry(e.target.value.split("-")[1] ?? "");
              if (guessed) setCurrency(guessed);
            }}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Currency
          <select
            data-testid="currency"
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
            }}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Display
          <select
            data-testid="display"
            value={display}
            onChange={(e) => {
              setDisplay(e.target.value as CurrencyDisplay);
            }}
          >
            {(["symbol", "narrowSymbol", "code", "name"] as const).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label>
          Format mode
          <select
            data-testid="format-mode"
            value={formatMode}
            onChange={(e) => {
              setFormatMode(e.target.value as "live" | "blur");
            }}
          >
            {(["live", "blur"] as const).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          Min fraction digits
          <input
            type="number"
            min={0}
            max={4}
            value={minFraction}
            onChange={(e) => {
              setMinFraction(Number(e.target.value));
            }}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={allowNegative}
            onChange={(e) => {
              setAllowNegative(e.target.checked);
            }}
          />
          Allow negative
        </label>
      </div>

      <div className="field">
        <label htmlFor="amount">Amount</label>
        <CurrencyInput
          id="amount"
          data-testid="amount"
          locale={locale}
          currency={currency}
          currencyDisplay={display}
          formatMode={formatMode}
          minimumFractionDigits={minFraction}
          allowNegative={allowNegative}
          value={value}
          onChange={setValue}
        />
      </div>

      <dl className="readout">
        <dt>Numeric value</dt>
        <dd data-testid="value">{value ?? "∅ (empty)"}</dd>
      </dl>
    </Section>
  );
}

const TRICKY: { locale: string; currency: string; note: string }[] = [
  { locale: "bg-BG", currency: "EUR", note: "Space group separator, only above 9999" },
  { locale: "de-DE", currency: "EUR", note: "Dot group, comma decimal, trailing symbol" },
  { locale: "fr-FR", currency: "EUR", note: "Narrow no-break space group separator" },
  { locale: "ja-JP", currency: "JPY", note: "No fraction digits" },
  { locale: "ar-KW", currency: "KWD", note: "Three fraction digits" },
  { locale: "ar-EG", currency: "EGP", note: "Native (Arabic-Indic) digits, RTL" },
  { locale: "hi-IN", currency: "INR", note: "Lakh grouping: 12,34,567" },
  { locale: "de-CH", currency: "CHF", note: "Apostrophe group separator" },
];

function TrickyGrid() {
  const [values, setValues] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(TRICKY.map((t) => [t.locale, 1234567.89])),
  );
  return (
    <Section
      id="tricky"
      title="The locales other libraries get wrong"
      note="All eight are formatted by the same code — Intl owns the rules, so none of these is a special case."
    >
      <div className="grid">
        {TRICKY.map((t) => (
          <div className="cell" key={t.locale} data-testid={`tricky-${t.locale}`}>
            <div className="cell-head">
              <code>{t.locale}</code> · <code>{t.currency}</code>
            </div>
            <p className="note">{t.note}</p>
            <CurrencyInput
              aria-label={`${t.locale} amount`}
              locale={t.locale}
              currency={t.currency}
              value={values[t.locale] ?? null}
              onChange={(v) => {
                setValues((prev) => ({ ...prev, [t.locale]: v }));
              }}
            />
          </div>
        ))}
      </div>
    </Section>
  );
}

interface FormValues {
  price: number | null;
}

function FormDemo() {
  const { control, handleSubmit } = useForm<FormValues>({ defaultValues: { price: null } });
  const [submitted, setSubmitted] = useState<number | null | undefined>(undefined);

  return (
    <Section
      id="form"
      title="React Hook Form"
      note="A controlled adapter with validation. Submit empty to see the error; enter an amount to see the parsed number."
    >
      <form
        onSubmit={(e) => {
          void handleSubmit((v) => {
            setSubmitted(v.price);
          })(e);
        }}
      >
        <Controller
          name="price"
          control={control}
          rules={{
            required: "Enter a price",
            min: { value: 1, message: "Must be greater than 0" },
          }}
          render={({ field, fieldState }) => (
            <div className="field">
              <label htmlFor="price">Price (EUR)</label>
              <CurrencyInput
                id="price"
                data-testid="form-price"
                locale="de-DE"
                currency="EUR"
                value={field.value ?? null}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                invalid={fieldState.invalid}
                aria-describedby={fieldState.error ? "price-err" : undefined}
              />
              {fieldState.error ? (
                <p id="price-err" className="error" data-testid="form-error">
                  {fieldState.error.message}
                </p>
              ) : null}
            </div>
          )}
        />
        <button type="submit">Submit</button>
      </form>
      {submitted !== undefined ? (
        <p className="readout" data-testid="form-result">
          Submitted: {submitted ?? "∅"}
        </p>
      ) : null}
    </Section>
  );
}

/** Purpose-built controls for destructive/manual QA and durable E2E edge cases. */
function StressLab() {
  const [controlled, setControlled] = useState<number | null>(12.5);
  const [stressLocale, setStressLocale] = useState<"en-US" | "de-DE">("en-US");
  const [lastChange, setLastChange] = useState<CurrencyInputChange | null>(null);
  const [stepped, setStepped] = useState<number | null>(0);
  const [negativeStep, setNegativeStep] = useState<number | null>(0);
  const [transformed, setTransformed] = useState<number | null>(null);

  const keepInputFocused = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <Section
      id="stress-lab"
      title="Adversarial test lab"
      note="Controlled rerenders, keyboard stepping, raw transforms, and uncontrolled state. These controls intentionally expose difficult lifecycle boundaries."
    >
      <div className="grid">
        <div className="cell">
          <label htmlFor="stress-controlled">Controlled external updates</label>
          <CurrencyInput
            id="stress-controlled"
            data-testid="stress-controlled"
            formatMode="blur"
            locale={stressLocale}
            currency={stressLocale === "en-US" ? "USD" : "EUR"}
            value={controlled}
            onChange={(next, meta) => {
              setControlled(next);
              setLastChange(meta);
            }}
          />
          <div className="button-row">
            <button
              type="button"
              data-testid="external-set"
              onMouseDown={keepInputFocused}
              onClick={() => {
                setControlled(42.5);
              }}
            >
              Set 42.5 externally
            </button>
            <button
              type="button"
              data-testid="external-clear"
              onMouseDown={keepInputFocused}
              onClick={() => {
                setControlled(null);
              }}
            >
              Clear externally
            </button>
            <button
              type="button"
              data-testid="external-locale"
              onMouseDown={keepInputFocused}
              onClick={() => {
                setStressLocale((old) => (old === "en-US" ? "de-DE" : "en-US"));
              }}
            >
              Toggle locale
            </button>
          </div>
          <output data-testid="stress-controlled-value">{controlled ?? "∅"}</output>
          <output data-testid="stress-meta">{lastChange ? JSON.stringify(lastChange) : "∅"}</output>
        </div>

        <div className="cell">
          <label htmlFor="stress-step">Non-negative 0.25 stepping</label>
          <CurrencyInput
            id="stress-step"
            data-testid="stress-step"
            formatMode="blur"
            locale="en-US"
            currency="USD"
            step={0.25}
            value={stepped}
            onChange={setStepped}
          />
          <output data-testid="stress-step-value">{stepped ?? "∅"}</output>
        </div>

        <div className="cell">
          <label htmlFor="stress-negative-step">Signed 0.25 stepping</label>
          <CurrencyInput
            id="stress-negative-step"
            data-testid="stress-negative-step"
            formatMode="blur"
            locale="en-US"
            currency="USD"
            step={0.25}
            allowNegative
            value={negativeStep}
            onChange={setNegativeStep}
          />
          <output data-testid="stress-negative-step-value">{negativeStep ?? "∅"}</output>
        </div>

        <div className="cell">
          <label htmlFor="stress-transform">Underscore cleanup</label>
          <CurrencyInput
            id="stress-transform"
            data-testid="stress-transform"
            formatMode="blur"
            locale="en-US"
            currency="USD"
            value={transformed}
            onChange={setTransformed}
            transformRawValue={(raw) => raw.replaceAll("_", "")}
          />
          <output data-testid="stress-transform-value">{transformed ?? "∅"}</output>
        </div>

        <div className="cell">
          <label htmlFor="stress-uncontrolled">Uncontrolled value</label>
          <CurrencyInput
            id="stress-uncontrolled"
            data-testid="stress-uncontrolled"
            formatMode="blur"
            locale="en-US"
            currency="USD"
            defaultValue={7.5}
          />
        </div>
      </div>
    </Section>
  );
}

export function CurrencyDemos({ dir = "ltr" }: { dir?: "ltr" | "rtl" } = {}) {
  return (
    <main dir={dir}>
      <Playground />
      <TrickyGrid />
      <FormDemo />
      <StressLab />
    </main>
  );
}

// Default export is the playground contract: it discovers demos by module,
// not by name. The named export stays for this package.
export default CurrencyDemos;
