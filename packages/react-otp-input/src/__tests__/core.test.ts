import { describe, expect, it } from "vitest";
import {
  buildSlots,
  defaultPasteTransform,
  expandOverwriteRange,
  inputModeFor,
  isComplete,
  normalizeLength,
  resolveIsAllowed,
  resolveMaskChar,
  sanitize,
  spatialLayout,
  spliceValue,
} from "../core";

describe("normalizeLength", () => {
  it.each([
    [6, 6],
    [4, 4],
    [1, 1],
    [8.7, 8],
    [0, 6],
    [-3, 6],
    [undefined, 6],
    [Number.NaN, 6],
    [Number.POSITIVE_INFINITY, 6],
  ])("normalizeLength(%p) -> %p", (input, expected) => {
    expect(normalizeLength(input)).toBe(expected);
  });
});

describe("resolveIsAllowed", () => {
  it("numeric accepts digits only", () => {
    const ok = resolveIsAllowed("numeric", undefined);
    expect(ok("0")).toBe(true);
    expect(ok("9")).toBe(true);
    expect(ok("a")).toBe(false);
    expect(ok("-")).toBe(false);
  });

  it("alpha accepts letters only, alphanumeric accepts both", () => {
    const alpha = resolveIsAllowed("alpha", undefined);
    const alnum = resolveIsAllowed("alphanumeric", undefined);
    expect(alpha("a")).toBe(true);
    expect(alpha("7")).toBe(false);
    expect(alnum("a")).toBe(true);
    expect(alnum("7")).toBe(true);
    expect(alnum("#")).toBe(false);
  });

  it("a custom string pattern beats mode", () => {
    const ok = resolveIsAllowed("numeric", "[a-f]");
    expect(ok("a")).toBe(true);
    expect(ok("9")).toBe(false);
  });

  it("strips the global flag so repeated tests are stable (no lastIndex drift)", () => {
    const ok = resolveIsAllowed("alphanumeric", /[0-9]/g);
    // With a live `g` flag these would alternate true/false.
    expect(ok("5")).toBe(true);
    expect(ok("5")).toBe(true);
    expect(ok("5")).toBe(true);
  });

  it("rejects multi-character input even against a permissive class", () => {
    const ok = resolveIsAllowed("alphanumeric", /[a-z]/);
    expect(ok("ab")).toBe(false);
  });

  it("falls back to the mode set when the custom pattern is malformed", () => {
    const ok = resolveIsAllowed("numeric", "[");
    expect(ok("3")).toBe(true);
    expect(ok("x")).toBe(false);
  });
});

describe("sanitize", () => {
  const numeric = resolveIsAllowed("numeric", undefined);

  it.each([
    [undefined, ""],
    [null, ""],
    [123456, "123456"],
    ["12-34", "1234"],
    ["abc123def", "123"],
    ["  9 9 9  ", "999"],
  ])("sanitize(%p) -> %p", (raw, expected) => {
    expect(sanitize(raw, 6, numeric)).toBe(expected);
  });

  it("clamps to length", () => {
    expect(sanitize("1234567890", 6, numeric)).toBe("123456");
  });

  it("applies transform after filtering, then clamps", () => {
    const alpha = resolveIsAllowed("alpha", undefined);
    expect(sanitize("a1b2c3", 4, alpha, (s) => s.toUpperCase())).toBe("ABC");
  });

  it("clamps even when a transform lengthens the value", () => {
    const alpha = resolveIsAllowed("alpha", undefined);
    expect(sanitize("ab", 3, alpha, (s) => s + s)).toBe("aba");
  });

  it("counts an astral character as one slot", () => {
    const any = resolveIsAllowed("numeric", /[\u{1F600}]/u);
    expect(sanitize("\u{1F600}\u{1F600}\u{1F600}", 2, any)).toBe("\u{1F600}\u{1F600}");
  });
});

describe("defaultPasteTransform", () => {
  it.each([
    ["123-456", "123456"],
    ["123 456", "123456"],
    ["1.2.3", "123"],
    ["1_2_3", "123"],
    ["\t12\n34 ", "1234"],
  ])("strips separators: %p -> %p", (input, expected) => {
    expect(defaultPasteTransform(input)).toBe(expected);
  });
});

describe("spliceValue", () => {
  it("appends at the caret", () => {
    expect(spliceValue("12", 2, 2, "34", 6)).toEqual({ value: "1234", caret: 4 });
  });

  it("replaces a selection, keeping the tail", () => {
    expect(spliceValue("123456", 1, 4, "9", 6)).toEqual({ value: "1956", caret: 2 });
  });

  it("truncates overflow to length", () => {
    expect(spliceValue("12", 2, 2, "3456789", 6)).toEqual({ value: "123456", caret: 6 });
  });

  it("inserts mid-value", () => {
    expect(spliceValue("16", 1, 1, "2345", 6)).toEqual({ value: "123456", caret: 5 });
  });

  it("tolerates reversed/out-of-range selection bounds", () => {
    expect(spliceValue("12", 5, -1, "ab", 6)).toEqual({ value: "ab", caret: 2 });
  });
});

describe("expandOverwriteRange", () => {
  it("expands a collapsed caret over its slot when the value is full", () => {
    expect(expandOverwriteRange(2, 2, 6, 6, null, false)).toEqual({ start: 2, end: 3 });
  });

  it("leaves a real range selection alone", () => {
    expect(expandOverwriteRange(1, 3, 6, 6, null, false)).toBeNull();
  });

  it("leaves the caret alone while the field still has room", () => {
    expect(expandOverwriteRange(2, 2, 5, 6, null, false)).toBeNull();
  });

  it("ignores the end-of-field caret so overflow typing stays dropped", () => {
    expect(expandOverwriteRange(6, 6, 6, 6, null, false)).toBeNull();
  });

  it("clamps an end-of-field caret onto the last slot when asked (pointer press)", () => {
    expect(expandOverwriteRange(6, 6, 6, 6, null, true)).toEqual({ start: 5, end: 6 });
  });

  it("steps one slot further left when the caret collapsed onto the previous range start", () => {
    expect(expandOverwriteRange(2, 2, 6, 6, { start: 2, end: 3 }, false)).toEqual({
      start: 1,
      end: 2,
    });
  });

  it("does not step left past the first slot", () => {
    expect(expandOverwriteRange(0, 0, 6, 6, { start: 0, end: 1 }, false)).toEqual({
      start: 0,
      end: 1,
    });
  });

  it("treats a collapse onto the previous range end as a forward step", () => {
    expect(expandOverwriteRange(3, 3, 6, 6, { start: 2, end: 3 }, false)).toEqual({
      start: 3,
      end: 4,
    });
  });

  it("never steps left off a previously collapsed caret", () => {
    expect(expandOverwriteRange(5, 5, 6, 6, { start: 6, end: 6 }, false)).toEqual({
      start: 5,
      end: 6,
    });
  });
});

describe("isComplete", () => {
  it.each([
    ["123456", 6, true],
    ["12345", 6, false],
    ["", 0, false],
  ])("isComplete(%p, %p) -> %p", (value, length, expected) => {
    expect(isComplete(value, length)).toBe(expected);
  });
});

describe("resolveMaskChar", () => {
  it.each([
    [undefined, null],
    [false, null],
    ["", null],
    [true, "•"],
    ["*", "*"],
  ])("resolveMaskChar(%p) -> %p", (mask, expected) => {
    expect(resolveMaskChar(mask)).toBe(expected);
  });
});

describe("inputModeFor", () => {
  it.each([
    ["numeric", "numeric"],
    ["alpha", "text"],
    ["alphanumeric", "text"],
  ] as const)("inputModeFor(%p) -> %p", (mode, expected) => {
    expect(inputModeFor(mode)).toBe(expected);
  });
});

describe("spatialLayout", () => {
  it("spreads glyphs to the slot pitch and centres the first one", () => {
    // slot 40px, gap 8px, char 12px -> pitch 48, tracking 36, indent 14.
    expect(spatialLayout(40, 8, 12)).toEqual({ letterSpacing: 36, textIndent: 14 });
  });

  it("works with a zero gap", () => {
    expect(spatialLayout(40, 0, 10)).toEqual({ letterSpacing: 30, textIndent: 15 });
  });

  it.each([
    [40, 8, 0],
    [40, 8, -1],
    [0, 8, 12],
    [Number.NaN, 8, 12],
    [40, 8, Number.NaN],
  ])("returns null for unmeasurable geometry (%p, %p, %p)", (slot, gap, char) => {
    expect(spatialLayout(slot, gap, char)).toBeNull();
  });
});

describe("buildSlots", () => {
  const base = {
    length: 4,
    isFocused: true,
    isDisabled: false,
    isReadOnly: false,
    placeholder: null,
    maskChar: null,
  };

  it("marks filled slots and puts the caret at the first empty slot", () => {
    const slots = buildSlots({ ...base, value: "12", selectionStart: 2, selectionEnd: 2 });
    expect(slots.map((s) => s.char)).toEqual(["1", "2", null, null]);
    expect(slots.map((s) => s.isFilled)).toEqual([true, true, false, false]);
    expect(slots[2]!.hasFakeCaret).toBe(true);
    expect(slots[2]!.isActive).toBe(true);
    expect(slots[0]!.hasFakeCaret).toBe(false);
  });

  it("clamps the caret onto the last slot when the value is full", () => {
    const slots = buildSlots({ ...base, value: "1234", selectionStart: 4, selectionEnd: 4 });
    expect(slots[3]!.hasFakeCaret).toBe(true);
  });

  it("activates every slot a range selection covers, with no caret", () => {
    const slots = buildSlots({ ...base, value: "1234", selectionStart: 1, selectionEnd: 3 });
    expect(slots.map((s) => s.isActive)).toEqual([false, true, true, false]);
    expect(slots.every((s) => !s.hasFakeCaret)).toBe(true);
  });

  it("shows no caret or active slot when unfocused", () => {
    const slots = buildSlots({
      ...base,
      isFocused: false,
      value: "12",
      selectionStart: 2,
      selectionEnd: 2,
    });
    expect(slots.every((s) => !s.isActive && !s.hasFakeCaret)).toBe(true);
  });

  it("masks filled characters but leaves isFilled true", () => {
    const slots = buildSlots({
      ...base,
      maskChar: "•",
      value: "12",
      selectionStart: 2,
      selectionEnd: 2,
    });
    expect(slots.map((s) => s.char)).toEqual(["•", "•", null, null]);
    expect(slots[0]!.isFilled).toBe(true);
  });

  it("exposes a placeholder only on empty slots", () => {
    const slots = buildSlots({
      ...base,
      placeholder: "·",
      value: "1",
      selectionStart: 1,
      selectionEnd: 1,
    });
    expect(slots.map((s) => s.placeholder)).toEqual([null, "·", "·", "·"]);
  });
});
