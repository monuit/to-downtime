import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    allowedHosts: ['*'], // Allow all hosts for Railway deployment
  },
  build: {
    target: 'ES2020',
    minify: 'terser',
  },
})
