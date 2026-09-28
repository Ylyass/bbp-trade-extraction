import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
try {
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 const dir=new URL('../supabase/migrations/',import.meta.url);
 for(const file of (await readdir(dir)).sort()) await db.exec(await readFile(new URL(file,dir),'utf8'));
 const student='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',hash='a'.repeat(64);
 await db.query('insert into auth.users values ($1),($2)',[student,other]);
 await db.query('insert into public.profiles(id) values ($1),($2)',[student,other]);
 await db.query("insert into public.connection_tokens(student_id,token_hash,expires_at) values($1,$2,now()+interval '1 day')",[student,hash]);
 const identity={platform:'MT5',collectorVersion:'0.1.0',brokerServer:'Demo',accountLogin:'9007199254740993',currency:'USD'};
 async function call(action,payload=identity,h=hash){await db.exec('set role service_role');try{return (await db.query('select public.collector_ingest($1,$2,$3::jsonb) as result',[h,action,JSON.stringify(payload)])).rows[0].result;}finally{await db.exec('reset role');}}
 async function lapse(){await db.exec('update public.connection_tokens set last_request_at=null');}
 assert.equal((await call('handshake',identity,'b'.repeat(64))).error,'unauthorized');
 assert.equal((await call('sync')).error,'handshake_required');
 assert.equal((await call('handshake')).ok,true);
 assert.equal((await call('heartbeat')).error,'rate_limited');
 await lapse(); assert.equal((await call('sync',{...identity,accountLogin:'999'})).error,'account_mismatch');
 const sync={...identity,snapshot:{capturedAt:'2026-09-22T10:00:00Z',balance:1000,equity:987.42}};
 assert.equal((await call('sync',sync)).ok,true);
 await lapse(); assert.equal((await call('sync',sync)).ok,true);
 assert.equal((await db.query('select count(*)::int as n from public.account_snapshots')).rows[0].n,1);
 await db.exec(`set role authenticated; set request.jwt.claim.sub='${student}';`);
 assert.equal((await db.query('select count(*)::int as n from public.account_snapshots')).rows[0].n,1);
 await db.exec(`set request.jwt.claim.sub='${other}';`);
 assert.equal((await db.query('select count(*)::int as n from public.account_snapshots')).rows[0].n,0);
 await assert.rejects(()=>db.query('select * from public.connection_tokens'));
 await assert.rejects(()=>db.query('select public.collector_ingest($1,$2,$3::jsonb)',[hash,'handshake',JSON.stringify(identity)]));
 await db.exec('reset role; update public.connection_tokens set revoked_at=now()');
 assert.equal((await call('sync',sync)).error,'unauthorized');
 await db.exec("update public.connection_tokens set revoked_at=null,expires_at=now()-interval '1 second',created_at=now()-interval '1 day'");
 assert.equal((await call('heartbeat')).error,'unauthorized');
 console.log('PASS: migrations, binding, auth, rate limit, snapshot idempotency, expiry, revocation and owner-only RLS');
} finally {await db.close();}
