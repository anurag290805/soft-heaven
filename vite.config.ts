import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { validateCommerceEnvironment } from './scripts/commerce-environment.mjs'

export default defineConfig(({ mode, command }) => {
  const errors = validateCommerceEnvironment({ ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }, { mode, command })
  if (errors.length) throw new Error(errors.join('\n'))
  return { plugins: [react(), tailwindcss()] }
})
