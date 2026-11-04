import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const directory = 'android/app/src/e2e/assets';
await mkdir(`${directory}/public`, { recursive: true });
const config = JSON.parse(await readFile('capacitor.config.json', 'utf8'));
config.server = { url: 'http://127.0.0.1:4100', cleartext: true };
await writeFile(`${directory}/capacitor.config.json`, JSON.stringify(config));
await build({ entryPoints: ['src/native.mjs'], bundle: true, outfile: `${directory}/public/native.js`,
  format: 'iife', target: 'chrome100', define: { __MOBILE_TEST_ORIGIN__: JSON.stringify(config.server.url) } });
