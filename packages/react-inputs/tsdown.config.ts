import { defineConfig } from "tsdown";
import { dualBuildConfig } from "@rxova/repo-config/tsdown";

// The meta-package: dual `.mjs`/`.cjs` re-exports of the component packages,
// which stay external as its runtime dependencies.
export default defineConfig(dualBuildConfig({ entry: { index: "src/index.ts" } }));
