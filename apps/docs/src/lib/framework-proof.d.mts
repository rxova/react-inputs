export interface FrameworkCompatibilityRow {
  packageName: string
  label: string
  dependency: string
  version: string
  rendering: string
  coverage: string
}

export declare function frameworkCompatibilityRows(
  manifests?: Record<string, Record<string, unknown>>,
): FrameworkCompatibilityRow[]
export declare const frameworkCompatibility: FrameworkCompatibilityRow[]
export declare function frameworkCompatibilityMarkdown(rows?: FrameworkCompatibilityRow[]): string
