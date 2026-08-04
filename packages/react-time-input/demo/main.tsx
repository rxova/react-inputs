import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TimeDemos } from './Demos'
import '@rxova/demo-kit/styles.css'

/** Standalone demo harness — the E2E target for this package. */
function Harness() {
  return (
    <>
      <header>
        <h1>Time input</h1>
      </header>
      <TimeDemos />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
