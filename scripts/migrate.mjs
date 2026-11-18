import { build } from 'esbuild';
await build({ entryPoints: ['src/server/migrate.ts'], bundle: true, platform: 'node', target: 'node20', format: 'esm', outfile: 'node_modules/.tmp/migrate.mjs', tsconfig: 'tsconfig.server.json', packages: 'external', logLevel: 'warning' });
await import(new URL('../node_modules/.tmp/migrate.mjs', import.meta.url).href);
