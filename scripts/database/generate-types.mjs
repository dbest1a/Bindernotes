import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {projectRoot} from './migration-bundle.mjs';
const explicitDatabase=process.argv.find(arg=>arg.startsWith('--database='))?.split('=')[1];
let psql,database,port='55439',user='postgres';
if(explicitDatabase){
 assert.match(explicitDatabase,/^bindernotes_test_[a-f0-9]{32}$/);database=explicitDatabase;
 const host=process.env.BINDERNOTES_TEST_DB_HOST??'127.0.0.1';assert(['127.0.0.1','localhost','::1'].includes(host),'Only disposable loopback catalogs');
 psql=path.join(process.env.BINDERNOTES_PG_BIN??'',process.platform==='win32'?'psql.exe':'psql');port=process.env.BINDERNOTES_TEST_DB_PORT??port;user=process.env.BINDERNOTES_TEST_DB_USER??user;
}else{
 const runtime=process.env.BINDERNOTES_LOCAL_RUNTIME;assert(runtime,'Set outside-repository BINDERNOTES_LOCAL_RUNTIME');
 const manifest=JSON.parse(await readFile(path.join(runtime,'local-api-stack.json'),'utf8'));
 assert.equal(manifest.apiUrl,'http://127.0.0.1:55442');assert.match(manifest.database,/^bindernotes_api_[a-f0-9]{32}$/);
 database=manifest.database;psql=path.join(runtime,'pgsql/bin/psql.exe');
}
const query=`select json_build_object(
 'tables',(select json_agg(json_build_object('name',c.relname,'kind',c.relkind,'columns',(select json_agg(json_build_object('name',a.attname,'type',t.typname,'typeSchema',tn.nspname,'category',t.typcategory,'element',et.typname,'nullable',not a.attnotnull,'default',ad.oid is not null,'identity',a.attidentity,'generated',a.attgenerated) order by a.attnum) from pg_attribute a join pg_type t on t.oid=a.atttypid join pg_namespace tn on tn.oid=t.typnamespace left join pg_type et on et.oid=t.typelem left join pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
 'relationships',(select json_agg(json_build_object('name',con.conname,'oneToOne',exists(select 1 from pg_constraint unique_key where unique_key.conrelid=con.conrelid and unique_key.contype in('p','u') and unique_key.conkey @> con.conkey and unique_key.conkey <@ con.conkey),'columns',(select json_agg(attname order by ord) from unnest(con.conkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=con.conrelid and a.attnum=k.num),'target',ref.relname,'targetColumns',(select json_agg(attname order by ord) from unnest(con.confkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=con.confrelid and a.attnum=k.num))) from pg_constraint con join pg_class ref on ref.oid=con.confrelid where con.conrelid=c.oid and con.contype='f')) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in('r','v','m')),
 'enums',(select json_agg(json_build_object('name',t.typname,'values',(select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid)) order by t.typname) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'),
 'functions',(select json_agg(json_build_object('name',p.proname,'returnType',rt.typname,'returnCategory',rt.typcategory,'returnElement',et.typname,'set',p.proretset,'defaults',p.pronargdefaults,'args',(select json_agg(json_build_object('name',coalesce(p.proargnames[k.ord], 'arg'||k.ord),'type',t.typname,'category',t.typcategory,'element',el.typname,'mode',coalesce(p.proargmodes[k.ord],'i'),'nullableDefault',pg_get_function_arguments(p.oid) ~ (coalesce(p.proargnames[k.ord], 'arg'||k.ord)||' [^,]+ DEFAULT NULL::')) order by k.ord) from unnest(coalesce(p.proallargtypes,p.proargtypes::oid[])) with ordinality k(oid,ord) join pg_type t on t.oid=k.oid left join pg_type el on el.oid=t.typelem)) order by p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_type rt on rt.oid=p.prorettype left join pg_type et on et.oid=rt.typelem where n.nspname='public' and p.prokind='f' and rt.typname not in('trigger','event_trigger')),
 'migrations',(select json_agg(version order by version) from supabase_migrations.schema_migrations));`;
const result=spawnSync(psql,['-X','-h','127.0.0.1','-p',port,'-U',user,'-d',database,'-q','-A','-t','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});assert.equal(result.status,0,result.stderr);
const schema=JSON.parse(result.stdout);const enums=new Set((schema.enums??[]).map(e=>e.name));const tables=new Set(schema.tables.map(t=>t.name));
function typeOf(type,category,element){
 if(category==='A')return `(${typeOf(element,'',null)})[]`;
 if(enums.has(type))return `Database["public"]["Enums"][${JSON.stringify(type)}]`;
 if(tables.has(type))return `Database["public"]["Tables"][${JSON.stringify(type)}]["Row"]`;
 if(['json','jsonb'].includes(type))return 'Json';if(type==='bool')return 'boolean';
 if(['int2','int4','int8','float4','float8','numeric','money','oid'].includes(type))return 'number';if(type==='void')return 'undefined';
 if(['text','varchar','bpchar','uuid','date','time','timetz','timestamp','timestamptz','interval','bytea','inet','cidr','name','char','regclass'].includes(type))return 'string';
 throw new Error(`Unmapped PostgreSQL type ${type}; extend generator deliberately`);
}
let output='// Generated from the actual disposable PostgreSQL catalog by scripts/database/generate-types.mjs.\n// Do not hand-edit. Migration versions: '+schema.migrations.join(',')+'\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport type Database = { public: {\nTables: {\n';
for(const table of schema.tables.filter(t=>t.kind==='r')){
 output+=`${JSON.stringify(table.name)}: {\n`;
 for(const mode of ['Row','Insert','Update']){output+=mode+': {\n';for(const column of table.columns){const optional=mode==='Update'||(mode==='Insert'&&(column.nullable||column.default||column.identity||column.generated));const type=column.generated&&mode!=='Row'?'never':typeOf(column.type,column.category,column.element)+(column.nullable?' | null':'');output+=`${JSON.stringify(column.name)}${optional?'?':''}: ${type};\n`;}output+='};\n';}
 output+='Relationships: ['+(table.relationships??[]).map(rel=>`{ foreignKeyName: ${JSON.stringify(rel.name)}; columns: ${JSON.stringify(rel.columns)}; isOneToOne: ${rel.oneToOne}; referencedRelation: ${JSON.stringify(rel.target)}; referencedColumns: ${JSON.stringify(rel.targetColumns)} }`).join(',')+'];\n};\n';
}
output+='};\nViews: {\n';for(const view of schema.tables.filter(t=>t.kind!=='r')){output+=`${JSON.stringify(view.name)}: { Row: {`+view.columns.map(c=>`${JSON.stringify(c.name)}: ${typeOf(c.type,c.category,c.element)} | null;`).join('')+'}; Relationships: [] };\n';}output+='};\nFunctions: {\n';
const grouped=new Map();for(const fn of schema.functions??[]){const input=(fn.args??[]).filter(a=>['i','b','v'].includes(a.mode));const out=(fn.args??[]).filter(a=>['o','b','t'].includes(a.mode));const args=input.length?'{'+input.map((a,i)=>`${JSON.stringify(a.name)}${i>=input.length-fn.defaults?'?':''}: ${typeOf(a.type,a.category,a.element)}${a.type==='json'||a.type==='jsonb'?'':' | null'};`).join('')+'}':'Record<PropertyKey, never>';const returns=out.length?'{'+out.map(a=>`${JSON.stringify(a.name)}: ${typeOf(a.type,a.category,a.element)};`).join('')+'}':typeOf(fn.returnType,fn.returnCategory,fn.returnElement);const contract=`{ Args: ${args}; Returns: ${returns}${fn.set?'[]':''} }`;grouped.set(fn.name,[...(grouped.get(fn.name)??[]),contract]);}
for(const [name,contracts]of grouped)output+=`${JSON.stringify(name)}: ${contracts.join(' | ')};\n`;
output+='};\nEnums: {\n';for(const e of schema.enums??[])output+=`${JSON.stringify(e.name)}: ${e.values.map(v=>JSON.stringify(v)).join(' | ')};\n`;output+='};\nCompositeTypes: Record<PropertyKey, never>;\n} };\n';
const target=path.join(projectRoot,'src/lib/database.generated.ts');
if(process.argv.includes('--check'))assert.equal(await readFile(target,'utf8'),output,'Generated Database types differ from the real local schema');else await writeFile(target,output,'utf8');
console.log(`${process.argv.includes('--check')?'Verified':'Generated'} ${schema.tables.filter(t=>t.kind==='r').length} tables and ${grouped.size} RPC names from actual local PostgreSQL catalog. No row data or secrets emitted.`);
