// Hand-written types for site-markdown.mjs, for the TypeScript endpoints in
// src/pages that consume it.

import type { LlmsOptions } from "@rxova/docs-kit";

/** As `componentPackages()` returns them. */
export interface ComponentRef {
  slug: string;
  label?: string;
  title?: string;
  name?: string;
  description?: string;
}

export declare function stripLiveMeta(fenceLine: string): string;
export declare function expandLiveExamples(text: string): string;
export declare function expandCodeRecipes(
  text: string,
  loadRecipes?: (slug: string) => { label: string; href: string; source: string }[],
): string;
export declare function expandFrameworkCompatibilityTable(text: string, matrix?: string): string;
export declare function sectionOf(id: string, components: ComponentRef[]): string;
export declare function llmsOptions(components: ComponentRef[]): LlmsOptions;
export declare function installPreamble(components: ComponentRef[], mount: string): string[];
