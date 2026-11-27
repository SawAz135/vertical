// Builds looplab.html: one self-contained file (CSS, mp4-muxer and all modules inlined).
// Usage: node build-single.mjs   (needs network once for `npx esbuild`)
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const js = execSync('npx --yes esbuild@0.24.0 js/main.js --bundle --format=iife --target=es2020 --legal-comments=none', { maxBuffer: 64 << 20 }).toString();
const css = readFileSync('app.css', 'utf8');
const mux = readFileSync('vendor/mp4-muxer.js', 'utf8');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
let html = readFileSync('index.html', 'utf8');
html = html.replace('<link rel="stylesheet" href="app.css">', () => `<style>\n${css}\n</style>`);
html = html.replace('<script src="vendor/mp4-muxer.js"></script>', () => `<script>/* mp4-muxer (MIT, Vanilagy) */\n${safe(mux)}\n</script>`);
html = html.replace('<script type="module" src="js/main.js"></script>', () => `<script>\n${safe(js)}\n</script>`);
writeFileSync('looplab.html', html);
console.log('looplab.html', (html.length / 1024).toFixed(0), 'Ko');
