// jscodeshift ships these subpaths without types.
declare module "jscodeshift/src/Runner" {
  export function run(
    transformPath: string,
    paths: string[],
    options: Record<string, unknown>,
  ): Promise<{ error: number; ok: number; nochange: number; skip: number }>;
}

declare module "jscodeshift/dist/testUtils" {
  import type { Transform } from "jscodeshift";
  export function applyTransform(
    module: Transform | { default: Transform },
    options: unknown,
    input: { source: string; path?: string },
    testOptions?: { parser?: string },
  ): string;
}
