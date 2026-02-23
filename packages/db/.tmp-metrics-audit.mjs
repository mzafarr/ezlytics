import dotenv from 'dotenv';
import { Pool } from '@neondatabase/serverless';

dotenv.config({ path: '../../apps/web/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sites = await pool.query('select id,name,domain,website_id,api_key,created_at from site order by created_at desc');
console.log('sites:', sites.rows.length);
console.table(sites.rows);

for (const s of sites.rows) {
  const now = Date.now();
  const last5 = now - 5 * 60 * 1000;
  const last30d = now - 30 * 24 * 60 * 60 * 1000;
  const [events, uniqRange, uniqNow, byBot, byType, byVisitor, lastEvents] = await Promise.all([
    pool.query("select count(*)::int as c from raw_event where site_id=$1", [s.id]),
    pool.query("select count(distinct visitor_id)::int as c from raw_event where site_id=$1 and type='pageview' and timestamp between $2 and $3 and coalesce(normalized->>'bot','false')!='true'", [s.id, last30d, now]),
    pool.query("select count(distinct visitor_id)::int as c from raw_event where site_id=$1 and type='pageview' and timestamp between $2 and $3 and coalesce(normalized->>'bot','false')!='true'", [s.id, last5, now]),
    pool.query("select coalesce(normalized->>'bot','false') as bot, count(*)::int as c from raw_event where site_id=$1 group by 1 order by 1", [s.id]),
    pool.query("select type, count(*)::int as c from raw_event where site_id=$1 group by 1 order by 1", [s.id]),
    pool.query("select visitor_id, count(*)::int as c from raw_event where site_id=$1 and type='pageview' group by 1 order by c desc limit 10", [s.id]),
    pool.query("select to_char(to_timestamp(timestamp/1000.0),'YYYY-MM-DD HH24:MI:SS') as ts, visitor_id, session_id, type, coalesce(normalized->>'bot','false') as bot, normalized->>'browser' as browser, normalized->>'device' as device from raw_event where site_id=$1 order by timestamp desc limit 10", [s.id]),
  ]);
  console.log('\nsite', s.id, s.name);
  console.log('raw_event total', events.rows[0]?.c);
  console.log('unique visitors (30d)', uniqRange.rows[0]?.c);
  console.log('visitors now (5m)', uniqNow.rows[0]?.c);
  console.log('by bot');
  console.table(byBot.rows);
  console.log('by type');
  console.table(byType.rows);
  console.log('top visitors');
  console.table(byVisitor.rows);
  console.log('last events');
  console.table(lastEvents.rows);
}

await pool.end();
