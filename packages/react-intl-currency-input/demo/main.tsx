import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CurrencyDemos } from "./Demos";
import "@rxova/demo-kit/styles.css";

/** Standalone demo harness — the E2E target for this package. */
function Harness() {
  return (
    <>
      <header>
        <h1>Currency input</h1>
        <a href="https://github.com/rxova/react-inputs">GitHub</a>
      </header>
      <CurrencyDemos />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
