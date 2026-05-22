// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@react': path.resolve(__dirname, './src/react'),
      '@system': path.resolve(__dirname, './src/react/system'),
      '@hook': path.resolve(__dirname, './src/react/hook'),
      '@config': path.resolve(__dirname, './src/react/config'),
      '@default': path.resolve(__dirname, './src/react/default'),
      '@redux': path.resolve(__dirname, './src/react/redux'),
      '@control': path.resolve(__dirname, './src/react/control'),
      '@feature': path.resolve(__dirname, './src/react/feature'),
      '@data': path.resolve(__dirname, './src/react/data'),
      '@animation': path.resolve(__dirname, './src/react/animation'),
    },
  },
  server: {
    host: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
  build: {
    // Naikkan limit warning chunk size menjadi 1000 kB
    chunkSizeWarningLimit: 1000,
  },
})