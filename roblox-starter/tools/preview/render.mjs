// Renders preview PNGs of the course with three.js in headless Chromium.
//
//   cd tools/preview && npm install && npx playwright install chromium   (once)
//   node tools/preview/render.mjs build/course.json build/preview
//
// Writes <out>-hero.png (1080x1920, phone) and <out>-overview.png (1920x1080).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const coursePath = resolve(process.argv[2] || 'build/course.json');
const outBase = resolve(process.argv[3] || 'build/preview');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };

// Tiny static server: ES modules cannot be imported over file://.
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = url.pathname === '/course.json' ? coursePath : join(here, url.pathname);
  if (!file.startsWith(here) && file !== coursePath) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const [shot, w, h] of [['hero', 1080, 1920], ['overview', 1920, 1080]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(`http://127.0.0.1:${port}/scene.html?shot=${shot}&w=${w}&h=${h}`);
    await page.waitForFunction(() => window.__done === true, null, { timeout: 120000 }).catch(() => {});
    if (errors.length) throw new Error(`render failed (${shot}): ${errors.join(' | ')}`);
    const out = `${outBase}-${shot}.png`;
    await page.locator('canvas').screenshot({ path: out });
    console.log(`wrote ${out}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
