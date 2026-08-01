import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

const radice = document.getElementById('root')
if (!radice) throw new Error('Elemento #root non trovato in index.html')

createRoot(radice).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
