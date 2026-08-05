import type { API, FileInfo, JSCodeshift } from 'jscodeshift'

/**
 * jscodeshift transform: the 1.0 `onChange` swap in `@rxova/react-intl-currency-input`.
 *
 * Until 1.0 this package was the one input in the suite where `onChange` meant
 * the DOM event and the parsed value arrived through `onValueChange` — the exact
 * inversion of the convention its own README states. 1.0 aligns it:
 *
 *   onValueChange={fn}  ->  onChange={fn}          the parsed value
 *   onChange={fn}       ->  onNativeChange={fn}    the raw DOM event
 *
 * Order matters, and doing it by hand in the wrong order silently makes the two
 * handlers swap places — which is the argument for a codemod rather than a
 * find-and-replace. Both renames are applied in one pass over each element.
 *
 * Scoped to elements that really are this component: the local name is resolved
 * from the import, so an alias is followed and an unrelated `<CurrencyInput>`
 * from another library is left alone. `useCurrencyInput` options objects are
 * rewritten too, since the hook took the same rename.
 */
const PACKAGE = '@rxova/react-intl-currency-input'

/** Local names bound to the component and to the hook, following aliases. */
function localNames(j: JSCodeshift, root: ReturnType<JSCodeshift>) {
  const components = new Set<string>()
  const hooks = new Set<string>()

  root.find(j.ImportDeclaration, { source: { value: PACKAGE } }).forEach((path) => {
    for (const specifier of path.node.specifiers ?? []) {
      if (specifier.type !== 'ImportSpecifier') continue
      const imported = specifier.imported.name
      const local = specifier.local?.name ?? imported
      if (typeof local !== 'string') continue
      if (imported === 'CurrencyInput') components.add(local)
      if (imported === 'useCurrencyInput') hooks.add(local)
    }
  })

  return { components, hooks }
}

/**
 * Rename both handlers on one property list, in one pass.
 *
 * Sequential renames would collide: rewriting `onValueChange` to `onChange`
 * first, then `onChange` to `onNativeChange`, walks the same handler through
 * both steps and lands it on the wrong prop.
 */
function renamePair(names: { name: string }[]): boolean {
  const wasValue = new Set(names.filter((node) => node.name === 'onValueChange'))
  const wasChange = new Set(names.filter((node) => node.name === 'onChange'))
  if (wasValue.size === 0 && wasChange.size === 0) return false

  for (const node of wasChange) node.name = 'onNativeChange'
  for (const node of wasValue) node.name = 'onChange'
  return true
}

export default function transform(file: FileInfo, api: API): string | undefined {
  const j = api.jscodeshift
  const root = j(file.source)
  const { components, hooks } = localNames(j, root)
  if (components.size === 0 && hooks.size === 0) return undefined

  let changed = false

  for (const name of components) {
    root.find(j.JSXOpeningElement, { name: { type: 'JSXIdentifier', name } }).forEach((path) => {
      const attributeNames = path.node.attributes
        ?.filter((attribute) => attribute.type === 'JSXAttribute')
        .map((attribute) => attribute.name)
        .filter((attributeName) => attributeName.type === 'JSXIdentifier')

      if (attributeNames && renamePair(attributeNames)) changed = true
    })
  }

  for (const name of hooks) {
    root.find(j.CallExpression, { callee: { type: 'Identifier', name } }).forEach((path) => {
      const [options] = path.node.arguments
      if (options?.type !== 'ObjectExpression') return

      const keys = options.properties
        .filter((property) => property.type === 'ObjectProperty' || property.type === 'Property')
        .map((property) => (property as { key: unknown }).key)
        .filter((key): key is { type: string; name: string } => {
          const candidate = key as { type?: string }
          return candidate.type === 'Identifier'
        })

      if (renamePair(keys)) changed = true
    })
  }

  return changed ? root.toSource() : undefined
}
