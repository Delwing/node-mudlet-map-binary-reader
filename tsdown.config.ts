import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  outDir: 'dist',
  // With `type: module` + esm, emit plain `.js` / `.d.ts` (not `.mjs` / `.d.mts`)
  // so the package.json `exports` map (./dist/index.js, ./dist/index.d.ts) resolves.
  fixedExtension: false,
});
