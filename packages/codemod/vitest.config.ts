import { baseVitestConfig } from "@rxova/repo-config/vitest";

// The transforms' fixture tests. No coverage gate, as before: the codemod is
// held by its fixtures and by the pack smoke test that runs a transform from the
// installed tarball.
export default baseVitestConfig({
  root: import.meta.dirname,
  include: ["src/**/__tests__/**/*.test.ts"],
  coverage: false,
});
