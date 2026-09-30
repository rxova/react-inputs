import { describe, expect, it } from "vitest";
import { applyTransform } from "jscodeshift/dist/testUtils";
import transform from "../transforms/input-otp-to-otp";

function run(source: string): string {
  return applyTransform(transform, {}, { source, path: "test.tsx" }, { parser: "tsx" });
}

describe("imports", () => {
  it("rewrites the input-otp import to @rxova/react-otp-input and renames OTPInput", () => {
    const out = run(`import { OTPInput } from 'input-otp'\nconst x = <OTPInput maxLength={6} />`);
    expect(out).toContain("from '@rxova/react-otp-input'");
    expect(out).not.toContain("'input-otp'");
    expect(out).toContain("OtpInput");
    expect(out).not.toContain("OTPInput");
    expect(out).toContain("<OtpInput");
  });

  it("preserves an alias, changing only the source and imported name", () => {
    const out = run(`import { OTPInput as OTP } from 'input-otp'\nconst x = <OTP maxLength={4} />`);
    expect(out).toContain("from '@rxova/react-otp-input'");
    expect(out).toContain("OtpInput as OTP");
    // The alias is still used at the call site.
    expect(out).toContain("<OTP");
    expect(out).toContain("length={4}");
  });

  it("renames type imports", () => {
    const out = run(`import type { OTPInputProps, SlotProps } from 'input-otp'`);
    expect(out).toContain("OtpInputProps");
    expect(out).toContain("OtpSlotState");
    expect(out).not.toContain("SlotProps");
    expect(out).toContain("from '@rxova/react-otp-input'");
  });

  it("keeps unmapped specifiers importing from input-otp, with a TODO", () => {
    const out = run(`import { OTPInput, REGEXP_ONLY_DIGITS } from 'input-otp'`);
    expect(out).toContain("import { OtpInput } from '@rxova/react-otp-input'");
    expect(out).toContain("REGEXP_ONLY_DIGITS");
    expect(out).toContain("from 'input-otp'");
    expect(out).toContain("TODO(@rxova/react-otp-input)");
  });

  it("leaves files without an input-otp import untouched", () => {
    // Returning undefined is jscodeshift's "no change" signal; applyTransform
    // surfaces that as an empty string, and the Runner leaves the file as-is.
    const source = `import { Something } from 'other'\nconst x = <Something maxLength={6} />`;
    expect(run(source)).toBe("");
  });
});

describe("props", () => {
  const base = (attrs: string) =>
    `import { OTPInput } from 'input-otp'\nconst x = <OTPInput ${attrs} />`;

  it("renames maxLength → length and containerClassName → className", () => {
    const out = run(base('maxLength={6} containerClassName="row"'));
    expect(out).toContain("length={6}");
    expect(out).toContain('className="row"');
    expect(out).not.toContain("maxLength");
    expect(out).not.toContain("containerClassName");
  });

  it("drops props with no equivalent", () => {
    const out = run(
      base('maxLength={6} pushPasswordManagerStrategy="increase-width" textAlign="center"'),
    );
    expect(out).not.toContain("pushPasswordManagerStrategy");
    expect(out).not.toContain("textAlign");
    expect(out).toContain("length={6}");
  });

  it("leaves value/onChange/pattern alone", () => {
    const out = run(base('value={code} onChange={setCode} pattern="^\\\\d+$"'));
    expect(out).toContain("value={code}");
    expect(out).toContain("onChange={setCode}");
    expect(out).toContain("pattern=");
  });
});

describe("render prop", () => {
  it("preserves render, renames placeholderChar, and adds a migration banner", () => {
    const out = run(
      `import { OTPInput } from 'input-otp'
const x = (
  <OTPInput
    maxLength={6}
    render={({ slots }) =>
      slots.map((slot, i) => <div key={i}>{slot.char ?? slot.placeholderChar}</div>)
    }
  />
)`,
    );
    expect(out).toContain("render=");
    expect(out).toContain("slot.char");
    expect(out).toContain("slot.placeholder");
    expect(out).not.toContain("placeholderChar");
    // Slot fields that carry over untouched.
    expect(out).toContain("@rxova/react-otp-input:");
    expect(out).toContain("components/otp/migrating/");
  });

  it("adds no banner when there is no render prop", () => {
    const out = run(`import { OTPInput } from 'input-otp'\nconst x = <OTPInput maxLength={6} />`);
    expect(out).not.toContain("@rxova/react-otp-input:");
  });
});
