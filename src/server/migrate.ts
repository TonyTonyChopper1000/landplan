// Apply SQL migrations and seed the rule library: DATABASE_URL=... npm run db:migrate [-- --postgis]
import { readFileSync, readdirSync } from 'node:fs';
import postgres from 'postgres';
import { RULES, RULES_VERSION } from '../rules/regulations';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Set DATABASE_URL');
const sql = postgres(url, { max: 1, onnotice: () => undefined, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require' });
const withPostgis = process.argv.includes('--postgis');
await sql`create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())`;
for (const f of readdirSync('db/migrations').filter((x) => x.endsWith('.sql')).sort()) {
  if (f.includes('postgis') && !withPostgis) continue;
  const done = await sql`select 1 from schema_migrations where id = ${f}`;
  if (done.length) continue;
  await sql.unsafe(readFileSync(`db/migrations/${f}`, 'utf8'));
  await sql`insert into schema_migrations (id) values (${f})`;
  console.log('applied', f);
}
await sql`insert into rule_sets (version, last_verified, rules) values (${RULES_VERSION}, ${'2026-11-17'}, ${sql.json(RULES as never)})
  on conflict (version) do update set rules = excluded.rules`;
console.log(`seeded rule set ${RULES_VERSION} (${RULES.length} rules)`);
await sql.end();
