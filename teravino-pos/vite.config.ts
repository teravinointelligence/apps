import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // xlsx va en el paquete principal a propósito: el corte se genera sin internet.
    chunkSizeWarningLimit: 1200,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
