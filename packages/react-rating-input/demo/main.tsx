import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { RatingDemos } from "./Demos";
import "@rxova/demo-kit/styles.css";

/** Standalone demo harness — the E2E target for this package. */
function Harness() {
  const [rtl, setRtl] = useState(false);

  return (
    <>
      <header>
        <h1>Rating input</h1>
        <label>
          <input
            type="checkbox"
            data-testid="rtl-toggle"
            checked={rtl}
            onChange={(e) => {
              setRtl(e.target.checked);
              document.documentElement.dir = e.target.checked ? "rtl" : "ltr";
            }}
          />
          Right-to-left
        </label>
      </header>
      <RatingDemos dir={rtl ? "rtl" : "ltr"} />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
