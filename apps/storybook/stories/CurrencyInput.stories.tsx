import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useArgs } from "storybook/preview-api";
import { fn } from "storybook/test";
import { CurrencyInput, useCurrencyInput } from "@rxova/react-intl-currency-input";

const meta = {
  title: "Components/Currency input",
  component: CurrencyInput,
  args: {
    currency: "EUR",
    locale: "de-DE",
    formatMode: "live",
    currencyDisplay: "symbol",
    allowNegative: false,
    invalid: false,
    disabled: false,
    placeholder: "Amount",
    "aria-label": "Amount",
    onChange: fn(),
  },
  argTypes: {
    currency: { control: "select", options: ["EUR", "USD", "BGN", "JPY", "KWD", "CHF"] },
    locale: {
      control: "select",
      options: ["de-DE", "en-US", "bg-BG", "ja-JP", "ar-EG", "de-CH", "en-IN"],
    },
    formatMode: { control: "inline-radio", options: ["live", "blur"] },
    currencyDisplay: {
      control: "select",
      options: ["symbol", "narrowSymbol", "code", "name"],
    },
    step: { control: { type: "number", step: 0.5 } },
    value: { control: false },
    // Functions have no useful control representation.
    transformRawValue: { control: false },
    onChange: { control: false },
    onNativeChange: { control: false },
    style: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="story">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CurrencyInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Type into the field and watch the parsed number in the Actions panel; switch
 * `locale`, `currency` or `currencyDisplay` live from the Controls panel.
 */
export const Playground: Story = {
  render: function Playground(args) {
    const [, updateArgs] = useArgs();
    return (
      <CurrencyInput
        {...args}
        onChange={(value, change) => {
          args.onChange?.(value, change);
          updateArgs({ value });
        }}
      />
    );
  },
};

/** One amount, formatted per locale/currency pair — all `Intl`, no locale data shipped. */
export const AroundTheWorld: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="story">
      {(
        [
          ["en-US", "USD"],
          ["de-DE", "EUR"],
          ["de-CH", "CHF"],
          ["bg-BG", "BGN"],
          ["ja-JP", "JPY"],
          ["en-IN", "INR"],
          ["ar-EG", "EGP"],
        ] as const
      ).map(([locale, currency]) => (
        <div key={locale} className="field">
          <label htmlFor={`atw-${locale}`}>
            {locale} · {currency}
          </label>
          <CurrencyInput
            id={`atw-${locale}`}
            locale={locale}
            currency={currency}
            defaultValue={1234567.89}
          />
        </div>
      ))}
    </div>
  ),
};

/**
 * `formatMode="blur"` shows a plain editable number while focused and only
 * formats when the field loses focus — no caret management at all.
 */
export const FormatOnBlur: Story = {
  args: { formatMode: "blur", defaultValue: 1299.99, "aria-label": "Price" },
};

/** JPY has zero fraction digits; the field simply refuses a decimal separator. */
export const ZeroDecimalCurrency: Story = {
  args: { currency: "JPY", locale: "ja-JP", defaultValue: 5000, "aria-label": "Amount in yen" },
};

/**
 * Refund-style field: negative amounts allowed, and ArrowUp/ArrowDown step the
 * value by 0.5, rounded to the currency's fraction precision.
 */
export const NegativeAndStepped: Story = {
  args: {
    currency: "USD",
    locale: "en-US",
    allowNegative: true,
    step: 0.5,
    defaultValue: -12.5,
    "aria-label": "Adjustment",
  },
};

/** `invalid` sets `aria-invalid` and `data-invalid`; the border is consumer CSS. */
export const Invalid: Story = {
  render: (args) => (
    <>
      <CurrencyInput {...args} invalid defaultValue={0.5} aria-describedby="cur-invalid-help" />
      <p id="cur-invalid-help" className="error">
        The minimum order is €1.00
      </p>
    </>
  ),
};

/**
 * The headless layer. `useCurrencyInput` owns parsing, formatting and the
 * caret; the markup — and everything around it — is yours.
 */
export const HeadlessHook: Story = {
  parameters: { controls: { disable: true } },
  render: function HeadlessHook() {
    const [value, setValue] = useState<number | null>(49.99);
    const { inputProps, ref, format, decimalSeparator, currencySymbol } = useCurrencyInput({
      locale: "de-DE",
      currency: "EUR",
      value,
      onChange: setValue,
    });
    return (
      <div className="story">
        <div className="field">
          <label htmlFor="headless-price">Price ({currencySymbol})</label>
          <input
            id="headless-price"
            {...inputProps}
            ref={(el) => {
              ref.current = el;
            }}
          />
        </div>
        <dl className="readout">
          <dt>parsed</dt>
          <dd>{value ?? "null"}</dd>
          <dt>formatted</dt>
          <dd>{format(value)}</dd>
          <dt>decimal separator</dt>
          <dd>{decimalSeparator}</dd>
        </dl>
      </div>
    );
  },
};
