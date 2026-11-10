// vite.config.ts
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEVELOPMENT_FALLBACK_API_URL = 'https://7680-agq2firibhstlf6sr7k3ydjoim.instabox.tech'
const PRODUCTION_FALLBACK_API_URL = 'https://warthadev-backend.onrender.com'

const isLoopbackApiUrl = (value: string): boolean => {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^\[|\]$/g, '')
    return hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '::1' || /^127(?:\.\d{1,3}){3}$/.test(hostname)
  } catch {
    return false
  }
}

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
  const configuredApiUrl = env.VITE_API_URL?.trim()
  const useProductionFallback = mode === 'production' && (!configuredApiUrl || isLoopbackApiUrl(configuredApiUrl))
  const API_URL = useProductionFallback
    ? PRODUCTION_FALLBACK_API_URL
    : configuredApiUrl || DEVELOPMENT_FALLBACK_API_URL

  return {
    plugins: [react(), cacheImageMotionPlugin()],
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(API_URL),
    },
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
