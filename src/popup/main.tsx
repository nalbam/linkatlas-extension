import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Popup } from './Popup'
import '@/styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root container #root not found')

createRoot(container).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
)
