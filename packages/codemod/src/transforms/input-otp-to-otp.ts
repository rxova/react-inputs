import type { API, ASTPath, FileInfo, JSCodeshift } from "jscodeshift";

/**
 * jscodeshift transform: migrate `input-otp` usage to `@rxova/react-otp-input`.
 *
 * It does the transforms that are always safe and deterministic:
 *   - rewrite the `input-otp` import to `@rxova/react-otp-input`
 *     (`OTPInput` → `OtpInput`, `OTPInputProps` → `OtpInputProps`,
 *      `SlotProps` → `OtpSlotState`), preserving any alias
 *   - rename every reference (JSX element, value, type) accordingly
 *   - rename props on the element: `maxLength` → `length`,
 *     `containerClassName` → `className`; drop `pushPasswordManagerStrategy`,
 *     `textAlign`, `noScriptCSSFallback` (no equivalent — the field never hacks
 *      its own width, so they aren't needed)
 *   - rename `slot.placeholderChar` → `slot.placeholder` inside render props
 *
 * The `render` prop is **preserved**, not rewritten: `@rxova/react-otp-input` supports
 * the same render-prop tier and the per-slot shape is compatible
 * (`char` / `isActive` / `hasFakeCaret` all carry over). Converting an arbitrary
 * render function into the compound `<OtpGroup>/<OtpSlot>` API can't be done
 * reliably by an AST transform, so that stays a documented manual step — a
 * banner comment points at the migration guide when a render prop is present.
 */

/** input-otp named export → @rxova/react-otp-input named export. */
const SPECIFIER_MAP: Record<string, string> = {
  OTPInput: "OtpInput",
  OTPInputProps: "OtpInputProps",
  SlotProps: "OtpSlotState",
};

const PROP_RENAME: Record<string, string> = {
  maxLength: "length",
  containerClassName: "className",
};

const PROP_REMOVE = new Set(["pushPasswordManagerStrategy", "textAlign", "noScriptCSSFallback"]);

const BANNER =
  " @rxova/react-otp-input: `render` was preserved (the slot shape is compatible). To adopt the compound " +
  "<OtpGroup>/<OtpSlot> API instead, see https://rxova.dev/packages/react-inputs/components/otp/migrating/";

/** Rename value/type Identifiers named `from` to `to`, skipping property keys and members. */
function renameIdentifiers(
  j: JSCodeshift,
  root: ReturnType<JSCodeshift>,
  from: string,
  to: string,
) {
  root.find(j.Identifier, { name: from }).forEach((path) => {
    const parent = path.parent.node as {
      type: string;
      property?: unknown;
      key?: unknown;
      computed?: boolean;
    };
    if (parent.type === "MemberExpression" && parent.property === path.node && !parent.computed)
      return;
    if (
      (parent.type === "Property" || parent.type === "ObjectProperty") &&
      parent.key === path.node &&
      !parent.computed
    )
      return;
    if (parent.type === "ImportSpecifier") return;
    path.node.name = to;
  });
  root.find(j.JSXIdentifier, { name: from }).forEach((path) => {
    const parent = path.parent.node as { type: string; name?: unknown };
    // Leave attribute names alone; only element/member names get renamed.
    if (parent.type === "JSXAttribute" && parent.name === path.node) return;
    path.node.name = to;
  });
}

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);
  let changed = false;

  // JSX/local names in this file that resolve to the OTP input component.
  const otpNames = new Set<string>();
  // (from, to) identifier renames to apply once imports are rewritten.
  const renames: [string, string][] = [];

  root
    .find(j.ImportDeclaration)
    .filter((path) => path.node.source.value === "input-otp")
    .forEach((path) => {
      const mapped: typeof path.node.specifiers = [];
      const kept: typeof path.node.specifiers = [];

      for (const spec of path.node.specifiers ?? []) {
        if (
          spec.type === "ImportSpecifier" &&
          spec.imported.type === "Identifier" &&
          SPECIFIER_MAP[spec.imported.name]
        ) {
          const original = spec.imported.name;
          const target = SPECIFIER_MAP[original]!;
          // @types/jscodeshift@17 widens an identifier's `name` to
          // `string | IdentifierKind`; for an import specifier's local it is
          // always a string at runtime, so narrow it back.
          const localName = typeof spec.local?.name === "string" ? spec.local.name : original;
          const aliased = localName !== original;

          spec.imported = j.identifier(target);
          if (!aliased) {
            spec.local = j.identifier(target);
            renames.push([original, target]);
          }
          if (original === "OTPInput") otpNames.add(aliased ? localName : target);
          mapped.push(spec);
        } else {
          kept.push(spec);
        }
      }

      if (mapped.length === 0) return;
      changed = true;
      path.node.source = j.literal("@rxova/react-otp-input");
      path.node.specifiers = mapped;

      // Anything with no @rxova/react-otp-input equivalent stays imported from input-otp
      // so the file still resolves, flagged for manual attention.
      if (kept.length > 0) {
        const keptDecl = j.importDeclaration(kept, j.literal("input-otp"));
        keptDecl.comments = [
          j.commentLine(
            " TODO(@rxova/react-otp-input): no direct equivalent — migrate manually",
            true,
            false,
          ),
        ];
        j(path).insertAfter(keptDecl);
      }
    });

  if (!changed) return undefined;

  for (const [from, to] of renames) renameIdentifiers(j, root, from, to);

  // Prop renames/removals on every OtpInput element, and detect render usage.
  let hasRender = false;
  for (const name of otpNames) {
    root.findJSXElements(name).forEach((path: ASTPath) => {
      const opening = (path.node as { openingElement: { attributes?: unknown[] } }).openingElement;
      opening.attributes = (opening.attributes ?? []).filter((attr) => {
        const a = attr as { type: string; name?: { type: string; name: string } };
        if (a.type !== "JSXAttribute" || a.name?.type !== "JSXIdentifier") return true;
        const propName = a.name.name;
        if (propName === "render") hasRender = true;
        if (PROP_REMOVE.has(propName)) return false;
        if (PROP_RENAME[propName]) a.name.name = PROP_RENAME[propName]!;
        return true;
      });
    });
  }

  // input-otp slots expose `placeholderChar`; ours is `placeholder`.
  root
    .find(j.MemberExpression, { property: { type: "Identifier", name: "placeholderChar" } })
    .forEach((path) => {
      const prop = path.node.property as { name: string };
      prop.name = "placeholder";
    });

  if (hasRender) {
    const first = root.find(j.Program).get("body", 0);
    if (first.node) {
      first.node.comments = [j.commentLine(BANNER, true, false), ...(first.node.comments ?? [])];
    }
  }

  return root.toSource({ quote: "single" });
}
