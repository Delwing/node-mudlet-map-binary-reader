import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The demo imports the library straight from `../src` so changes are live
// without a rebuild. `fs.allow` lets Vite read files outside `demo/`.
//
// `base: './'` emits relative asset paths, so the build works under any
// GitHub Pages project subpath without hardcoding the repo name.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    fs: { allow: ['..'] },
  },
});
