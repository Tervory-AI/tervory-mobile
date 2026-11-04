import { build } from 'esbuild';

await build({
  entryPoints: ['src/native.mjs'], bundle: true, outfile: 'www/native.js',
  format: 'iife', target: ['safari15', 'chrome100'], legalComments: 'eof',
});
