import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

// Só em dev (nunca entra no build de produção — import.meta.env.DEV é substituído em tempo de
// build e a branch inteira é eliminada por tree-shaking). Deixa os testes E2E lerem o estado real
// da store direto (`page.evaluate(() => window.__testStore.getState())`) em vez de inferir tudo
// através de bounding box / elementFromPoint — mais rápido e muito mais confiável de depurar.
if (import.meta.env.DEV) {
  import('./state/projectStore').then(({ useProjectStore }) => {
    ;(window as unknown as { __testStore: typeof useProjectStore }).__testStore = useProjectStore
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
