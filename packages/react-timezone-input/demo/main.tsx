import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TimezoneDemos } from './Demos'
import '@rxova/demo-kit/styles.css'

/** Standalone demo harness — the E2E target for this package. */
function Harness() {
  return (
    <>
      <header>
        <h1>Time zone input</h1>
      </header>
      <TimezoneDemos />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
