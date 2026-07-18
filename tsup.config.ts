import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm', 'cjs'],
  target: 'node18',
  outDir: 'dist',
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  shims: true,
  banner: {
    js: '',
  },
});
