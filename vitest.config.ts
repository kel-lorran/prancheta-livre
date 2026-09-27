import { defineConfig } from 'vitest/config'

// Testes unitários de lógica pura (conversões de coordenada, geometria de resize) — sem browser,
// sem DOM. Complementa o Playwright (e2e/), que cobre interação real na UI; isso aqui existe pra
// pegar erros de matemática/lógica em milissegundos, sem precisar simular arraste de mouse.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
