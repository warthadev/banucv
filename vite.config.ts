// vite.config.ts
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const cacheImageMotionPlugin = (): Plugin => ({
  name: 'cache-image-motion',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith('/image/motion/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      }
      next()
    })
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url && req.url.startsWith('/image/motion/')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      }
      next()
    })
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const API_URL = env.VITE_API_URL || 'https://warthadev-wartha-backend.hf.space'

  return {
    plugins: [react(), cacheImageMotionPlugin()],
    define: {},
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
        '@animation': path.resolve(__dirname, './src/react/animation'),
      },
    },
    server: {
      host: true,
      historyApiFallback: true,
      watch: {
        usePolling: true,
        interval: 100,
      },
      proxy: {
        '/telegram': {
          target: API_URL,
          changeOrigin: true,
          secure: false,
        },
        '/extract': {
          target: API_URL,
          changeOrigin: true,
          secure: false,
        },
        '/token': {
          target: API_URL,
          changeOrigin: true,
          secure: false,
        },
        '/hf-api': {
          target: 'https://huggingface.co',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/hf-api/, ''),
        },
      },
    },
    preview: {
      headers: {},
    },
    build: {
      chunkSizeWarningLimit: 1000,
    },
  }
})