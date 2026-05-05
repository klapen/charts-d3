import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Resolve `/dir/` URLs to `/dir/index.html` for files in publicDir.
// Vite's dev server doesn't do this by default; static hosts (S3, nginx) typically do.
function publicDirIndexFallback(publicDir) {
  return {
    name: 'public-dir-index-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && req.url.endsWith('/') && !req.url.startsWith('/@')) {
          const candidate = join(publicDir, req.url, 'index.html')
          if (existsSync(candidate)) {
            req.url = req.url + 'index.html'
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
  plugins: [tailwindcss(), publicDirIndexFallback(publicDir)],
})
