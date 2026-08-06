import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { InputsShowcase } from './InputsShowcase'

const root = document.getElementById('root')
if (!root) throw new Error('missing #root')

createRoot(root).render(
  <StrictMode>
    <InputsShowcase />
  </StrictMode>,
)
