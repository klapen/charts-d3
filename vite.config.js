import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Resolve `/dir/` URLs to `/dir/index.html`. Vite's dev server doesn't do this
// for files in publicDir; static hosts (S3, nginx) typically do.
function dirIndexFallback(publicDir) {
  return {
    name: 'dir-index-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && req.url.endsWith('/') && !req.url.startsWith('/@')) {
          const path = req.url.split('?')[0]
          const inPublic = join(publicDir, path, 'index.html')
          const inRoot = join(__dirname, path, 'index.html')
          if (existsSync(inPublic) || existsSync(inRoot)) {
            req.url = req.url.replace(/\/(\?|$)/, '/index.html$1')
          }
        }
        next()
      })
    },
  }
}

const publicDir = 'src/public'

export default defineConfig({
  publicDir,
  plugins: [tailwindcss(), dirIndexFallback(publicDir)],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        'population-pyramid': resolve(
          __dirname,
          'viz/population-pyramid/index.html',
        ),
        'zoom-treemap': resolve(
          __dirname,
          'viz/zoom-treemap/index.html',
        ),
        'conceptual-map': resolve(
          __dirname,
          'viz/conceptual-map/index.html',
        ),
        choco: resolve(__dirname, 'viz/choco/index.html'),
        'map-and-horizontal-bars': resolve(
          __dirname,
          'viz/map-and-horizontal-bars/index.html',
        ),
        labour: resolve(__dirname, 'viz/labour/index.html'),
      },
    },
  },
})
