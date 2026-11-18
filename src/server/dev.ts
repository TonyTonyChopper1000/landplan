// Local API server: `npm run dev:api` (Vite proxies /v1 to it).
import { createServer } from 'node:http';
import { nodeHandler } from './node';

const port = Number(process.env.PORT ?? 8787);
createServer((req, res) => {
  nodeHandler(req, res).catch((e) => {
    res.writeHead(500, { 'content-type': 'application/problem+json' });
    res.end(JSON.stringify({ title: 'Internal error', status: 500, detail: String(e) }));
  });
}).listen(port, () => console.log(`LandPlan API on http://localhost:${port}/v1 (docs: /v1/docs)`));
