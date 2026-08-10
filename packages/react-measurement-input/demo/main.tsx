import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MeasurementDemos } from './Demos'
import '@rxova/demo-kit/styles.css'

/** Standalone demo harness — the E2E target for this package. */
function Harness() {
  return (
    <>
      <header>
        <h1>Measurement input</h1>
      </header>
      <MeasurementDemos />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
)
