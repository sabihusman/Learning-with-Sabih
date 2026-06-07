// Minimal zero-dependency static file server for the exported ./out directory.
// Used by Playwright's webServer to serve the built static site locally. Handles
// the project's trailingSlash routing (a directory maps to its index.html).
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, resolve, normalize } from 'node:path'

const ROOT = resolve(process.cwd(), 'out')
const PORT = Number(process.env.PORT) || 4173

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

async function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  let p = join(ROOT, clean)
  if (!p.startsWith(ROOT)) return null // guard against traversal
  const s = await stat(p).catch(() => null)
  if (s && s.isDirectory()) p = join(p, 'index.html')
  else if (!s) {
    const idx = join(ROOT, clean, 'index.html')
    if (await stat(idx).catch(() => null)) p = idx
    else return null
  }
  return p
}

createServer(async (req, res) => {
  let file = await resolveFile(req.url)
  let code = 200
  if (!file) {
    file = join(ROOT, '404.html')
    code = 404
  }
  try {
    const data = await readFile(file)
    res.writeHead(code, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' })
    res.end('not found')
  }
}).listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[serve-out] http://localhost:${PORT} -> ${ROOT}`)
})
