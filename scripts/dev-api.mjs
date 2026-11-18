// Bundle and run the API locally on :8787 (rebuilds on start).
import { build } from 'esbuild';
await build({ entryPoints: ['src/server/dev.ts'], bundle: true, platform: 'node', target: 'node22', format: 'esm', outfile: 'node_modules/.tmp/dev-api.mjs', tsconfig: 'tsconfig.server.json', banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" }, logLevel: 'warning' });
await import(new URL('../node_modules/.tmp/dev-api.mjs', import.meta.url).href);
