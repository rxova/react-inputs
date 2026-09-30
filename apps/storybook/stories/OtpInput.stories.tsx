import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { OtpInput, OtpGroup, OtpSlot, OtpSeparator } from "@rxova/react-otp-input";

const meta = {
  title: "Components/OTP input",
  component: OtpInput,
  subcomponents: { OtpGroup, OtpSlot, OtpSeparator },
  args: {
    length: 6,
    mode: "numeric",
    slotInteraction: "spatial",
    label: "One-time code",
    disabled: false,
    readOnly: false,
    invalid: false,
    mask: false,
    onChange: fn(),
    onComplete: fn(),
  },
  argTypes: {
    mode: { control: "select", options: ["numeric", "alphanumeric", "alpha"] },
    slotInteraction: { control: "inline-radio", options: ["spatial", "crush"] },
    length: { control: { type: "number", min: 1, max: 12, step: 1 } },
    mask: { control: "boolean" },
    value: { control: false },
    // Functions, refs and children have no useful control representation.
    pattern: { control: false },
    transform: { control: false },
    pasteTransform: { control: false },
    render: { control: false },
    children: { control: false },
    inputRef: { control: false },
    style: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="story">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof OtpInput>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every prop is live in the Controls panel; the two spies log to Actions. */
export const Playground: Story = {};

/** Compound composition: two explicit groups joined by a separator, 123–456. */
export const Grouped: Story = {
  render: (args) => (
    <OtpInput {...args} label="Grouped code">
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
  ),
};

/** `mode` switches the character class; `transform` normalizes each commit. */
export const Alphanumeric: Story = {
  args: {
    mode: "alphanumeric",
    transform: (s: string) => s.toUpperCase(),
    label: "Alphanumeric code",
  },
};

/** Sensitive codes render a mask character instead of the value. */
export const Masked: Story = {
  args: { length: 4, defaultValue: "1234", mask: true, label: "PIN" },
};

/** A per-slot placeholder shown while the slot is empty. */
export const WithPlaceholder: Story = {
  args: { length: 4, placeholder: "·", label: "Code with placeholder" },
};

/**
 * The Tier-3 escape hatch: `render` receives per-slot state and draws
 * completely custom cells — no `<OtpSlot>` involved.
 */
export const CustomRender: Story = {
  args: {
    length: 4,
    label: "Custom render",
    render: ({ slots }) => (
      <div style={{ display: "inline-flex", gap: "0.5rem" }}>
        {slots.map((slot) => (
          <span
            key={slot.index}
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
    ),
  },
};

/** `invalid` sets `aria-invalid` and `data-invalid`; the ring is a consumer token. */
export const Invalid: Story = {
  render: (args) => (
    <>
      <OtpInput {...args} defaultValue="12" invalid aria-describedby="otp-invalid-help" />
      <p id="otp-invalid-help" className="error">
        That code has expired
      </p>
    </>
  ),
};

/** Disabled: exposed to assistive tech, not editable. */
export const Disabled: Story = {
  args: { defaultValue: "123", disabled: true, label: "Disabled code" },
};

/** Read-only: the value is shown and focusable, but not editable. */
export const ReadOnly: Story = {
  args: { defaultValue: "482913", readOnly: true, label: "Read-only code" },
};

/**
 * `slotInteraction="crush"` opts into collapsed-input behaviour everywhere
 * (the layout iOS always gets, since it cannot fully hide `::selection`).
 */
export const CrushInteraction: Story = {
  args: { slotInteraction: "crush", label: "Crush code" },
};

/**
 * With `name` set the value posts through native form submission — no form
 * library required. Submit to see the `FormData` payload.
 */
export const InAForm: Story = {
  render: function InAForm(args) {
    const [submitted, setSubmitted] = useState<string | null>(null);
    return (
      <form
        className="story"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))));
        }}
      >
        <OtpInput {...args} name="code" label="Code" />
        <button type="submit">Submit</button>
        <output>{submitted ?? "not submitted"}</output>
      </form>
    );
  },
};
