import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base '/prancheta-livre/' pra funcionar em https://<usuario>.github.io/prancheta-livre/ —
// ajuste se o nome do repositório no GitHub for diferente.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/prancheta-livre/' : '/',
}))
