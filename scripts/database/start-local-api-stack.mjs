import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { closeSync, openSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import net from 'node:net';
import { projectRoot, readMigrationBundle } from './migration-bundle.mjs';

// Native, disposable development stack. No .env loading, remote connection or
// production credentials. Prerequisites are documented in README.md.
const runtime = path.resolve(process.env.BINDERNOTES_LOCAL_RUNTIME ?? '');
assert(process.env.BINDERNOTES_LOCAL_RUNTIME, 'Set BINDERNOTES_LOCAL_RUNTIME to the outside-repository native runtime directory');
assert(!runtime.startsWith(projectRoot + path.sep), 'Keep runtime data and credentials outside the repository');
const database = `bindernotes_api_${randomUUID().replaceAll('-', '')}`;
const psql = path.join(runtime, 'pgsql/bin/psql.exe');
const base = ['-X','-h','127.0.0.1','-p','55439','-U','postgres','-q','-A','-t','-v','ON_ERROR_STOP=1'];
function sql(statement, db = database) {
  const result = spawnSync(psql,[...base,'-d',db],{input:statement,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024,
    env:{...process.env,PGOPTIONS:'-c client_min_messages=warning'}});
  if(result.error || result.status!==0) throw new Error(result.error?.message ?? result.stderr);
  return result.stdout.trim();
}
const secret = randomBytes(48).toString('base64url');
function jwt(role) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const body = `${encode({alg:'HS256',typ:'JWT'})}.${encode({role,iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+604800})}`;
  return `${body}.${createHmac('sha256',secret).update(body).digest('base64url')}`;
}
const anonKey = jwt('anon');
const serviceKey = jwt('service_role');
const apiUrl = 'http://127.0.0.1:55442';
const env = {...process.env,
  GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_EXP:'3600',GOTRUE_JWT_AUD:'authenticated',
  GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',
  GOTRUE_DB_DRIVER:'postgres',DB_NAMESPACE:'auth',DATABASE_URL:`postgres://postgres@127.0.0.1:55439/${database}?sslmode=disable&search_path=auth,public,extensions`,
  API_EXTERNAL_URL:apiUrl,GOTRUE_API_HOST:'127.0.0.1',PORT:'55440',
  GOTRUE_DB_MAX_POOL_SIZE:'3',GOTRUE_DB_MAX_IDLE_POOL_SIZE:'1',GOTRUE_MAILER_AUTOCONFIRM:'true',
  GOTRUE_DISABLE_SIGNUP:'false',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_EXTERNAL_PHONE_ENABLED:'false',
  GOTRUE_SITE_URL:'http://127.0.0.1:5173',GOTRUE_URI_ALLOW_LIST:'http://127.0.0.1:*,http://localhost:*',
  GOTRUE_LOG_LEVEL:'warn',GOTRUE_SECURITY_REFRESH_TOKEN_REUSE_INTERVAL:'10',
};
const children = [];
async function requireFreePort(port) {
  const listening=await new Promise(resolve=>{
    const socket=net.createConnection({host:'127.0.0.1',port});
    socket.once('connect',()=>{socket.destroy();resolve(true);});
    socket.once('error',()=>resolve(false));
  });
  assert(!listening,`Local port ${port} is already occupied; do not replace an existing stack or its credential manifest`);
}
function start(executable,args,childEnv,label) {
  const fd = openSync(path.join(runtime,`${label}.log`),'a');
  const child = spawn(executable,args,{cwd:runtime,env:childEnv,detached:true,windowsHide:true,stdio:['ignore',fd,fd]});
  closeSync(fd); child.unref(); children.push(child); return child;
}
async function healthy(url) {
  for(let i=0;i<160;i++) {
    try {const response=await fetch(url);if(response.ok)return;} catch { /* service starting */ }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error(`Local service did not become healthy: ${url}; inspect outside-repository runtime logs`);
}
let created=false;
try {
  for(const port of [55440,55441,55442]) await requireFreePort(port);
  sql(`create database "${database}";`,'postgres');created=true;
  const fixture = (await readFile(path.join(projectRoot,'scripts/database/platform-fixture.sql'),'utf8'))
    .replace(/^create table auth\.(users|sessions)[^\n]*\n/gm,'');
  assert(!fixture.includes('create table auth.users'),'GoTrue must own the complete auth.users schema');sql(fixture);
  const migration = spawnSync(path.join(runtime,'gotrue.exe'),['migrate'],{cwd:runtime,env,encoding:'utf8',windowsHide:true});
  await writeFile(path.join(runtime,'gotrue-migrate.log'),migration.stdout+ migration.stderr,'utf8');
  assert.equal(migration.status,0,'Real GoTrue migration failed; inspect gotrue-migrate.log outside repository');
  const pgmq = await readFile(path.join(runtime,'pgmq-1.5.1.sql'));
  assert.equal(createHash('sha256').update(pgmq).digest('hex'),'65b9302faa660539584769a572b57f2df76ccf1b3a2153c37cefc57b8db633e9');
  sql(pgmq.toString('utf8'));
  for(const migration of await readMigrationBundle()) {
    let content=migration.sql;
    if(migration.version==='0018') {
      content=content.replace(/^create extension if not exists (pg_cron|pgmq) with schema extensions;\r?\n/gm,'');
      let removed=0;
      content=content.replace(/do \$\$\s*begin\s*perform cron\.unschedule[\s\S]*?\$\$;/g,()=>{removed++;return '';});
      content=content.replace(/select cron\.schedule\([\s\S]*?\n\);/g,()=>{removed++;return '';});
      assert.equal(removed,4,'Only omit known cron registration blocks');
    }
    sql(`begin; ${content}\ninsert into supabase_migrations.schema_migrations(version,name) values('${migration.version}','${migration.name}');commit;`);
  }
  sql(`do $$ begin create role bindernotes_local_authenticator login noinherit; exception when duplicate_object then null; end $$;
    grant anon,authenticated,service_role to bindernotes_local_authenticator;`);
  start(path.join(runtime,'gotrue.exe'),['serve'],env,'gotrue');
  await healthy('http://127.0.0.1:55440/health');
  start(path.join(runtime,'postgrest/postgrest.exe'),[],{...process.env,PATH:`${path.join(runtime,'pgsql/bin')}${path.delimiter}${process.env.PATH}`,
    PGRST_DB_URI:`postgres://bindernotes_local_authenticator@127.0.0.1:55439/${database}?sslmode=disable`,
    PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,
    PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:'55441',PGRST_DB_POOL:'5',PGRST_LOG_LEVEL:'warn'},'postgrest');
  await healthy('http://127.0.0.1:55441/');
  start(process.execPath,[path.join(projectRoot,'scripts/database/local-api-proxy.mjs')],process.env,'local-api-proxy');
  await healthy(`${apiUrl}/auth/v1/health`);
  const users=[];
  for(const name of ['learner-a','learner-b','creator','operator']) {
    const user={name,email:`${name}@bindernotes.invalid`,password:`Local-${randomBytes(18).toString('base64url')}!`};
    const response=await fetch(`${apiUrl}/auth/v1/admin/users`,{method:'POST',headers:{authorization:`Bearer ${serviceKey}`,'content-type':'application/json'},
      body:JSON.stringify({email:user.email,password:user.password,email_confirm:true,user_metadata:{full_name:`Local ${name}`}})});
    assert(response.ok,`Local Auth user creation failed with ${response.status}`);
    user.id=(await response.json()).id;assert(user.id);users.push(user);
  }
  const operator=users.find(user=>user.name==='operator');const creator=users.find(user=>user.name==='creator');
  sql(`update public.profiles set role='admin' where id='${operator.id}';
    insert into public.account_entitlements(user_id,plan,status,source) values('${creator.id}','studio','active','disposable-test');`);
  const seed = spawnSync(process.execPath,['--import','tsx',path.join(projectRoot,'scripts/database/catalog-fixture.ts'),operator.id],{cwd:projectRoot,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});
  assert.equal(seed.status,0,'Local catalog fixture failed');
  sql(`begin; set local role service_role; select public.apply_catalog_seed('${JSON.stringify(JSON.parse(seed.stdout)).replaceAll("'","''")}'::jsonb);commit;`);
  const manifest={database,apiUrl,anonKey,serviceRoleKey:serviceKey,users,pids:children.map(child=>child.pid),createdAt:new Date().toISOString(),
    limitations:['Windows GoTrue startup patch removes Unix SO_REUSEPORT only','No pg_cron worker/registration','No Storage HTTP or Realtime service']};
  await writeFile(path.join(runtime,'local-api-stack.json'),JSON.stringify(manifest,null,2),'utf8');
  console.log(`PASS: real local GoTrue + PostgREST started; four disposable users and catalogs created. API ${apiUrl}.`);
  console.log('Credentials were written outside the repository to local-api-stack.json; no credentials printed.');
} catch(error) {
  for(const child of children) child.kill();
  if(created) sql(`drop database "${database}" with (force);`,'postgres');
  throw error;
}
