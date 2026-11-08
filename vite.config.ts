import { defineConfig } from 'vite';
import { generateCoreValidator } from './scripts/generate-core-validator.mjs';
import { assertCspCompatible } from './scripts/check-csp.mjs';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: false },
  plugins: [{
    name: 'csp-compatible-validation',
    async buildStart() { await generateCoreValidator(); },
    generateBundle(_options, bundle) {
      for (const id of this.getModuleIds()) {
        if (/\/node_modules\/ajv\/dist\/(?:compile\/|core\.js|2020\.js)/.test(id)) {
          this.error(`Ajv's schema compiler must remain build-only: ${id}`);
        }
      }
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk') assertCspCompatible(output.code, output.fileName);
      }
    },
  }],
});
