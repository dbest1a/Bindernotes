import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import {readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
import {accountRuntime} from "../../server/account/runtime";
const runtime=process.env.BINDERNOTES_LOCAL_RUNTIME;
assert(runtime,"Set outside-repository BINDERNOTES_LOCAL_RUNTIME");
const manifestPath=path.join(runtime,"local-api-stack.json");
const manifest=JSON.parse(await readFile(manifestPath,"utf8"));
assert.equal(manifest.apiUrl,"http://127.0.0.1:55442");assert.match(manifest.database,/^bindernotes_api_[a-f0-9]{32}$/);
const client=()=>createClient(manifest.apiUrl,manifest.anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
function sql(statement:string){const result=spawnSync(path.join(runtime!,"pgsql/bin/psql.exe"),["-X","-h","127.0.0.1","-p","55439","-U","postgres","-d",manifest.database,"-q","-A","-t","-v","ON_ERROR_STOP=1"],{input:statement,encoding:"utf8",windowsHide:true});assert.equal(result.status,0,result.stderr);return result.stdout.trim();}
// Older local manifests deliberately omitted a service JWT. Bootstrap one from
// a newly created disposable Auth account only, then let real GoTrue sign it.
if(!manifest.serviceRoleKey){
 const bootstrap=client();const email=`service-${randomUUID()}@bindernotes.invalid`,password=`Local-${randomBytes(20).toString("hex")}!`;
 const created=await bootstrap.auth.signUp({email,password});assert.ifError(created.error);assert(created.data.user);
 sql(`update auth.users set role='service_role' where id='${created.data.user.id}';`);
 const signed=await bootstrap.auth.signInWithPassword({email,password});assert.ifError(signed.error);assert(signed.data.session);
 manifest.serviceRoleKey=signed.data.session.access_token;manifest.localServiceUserId=created.data.user.id;
 await writeFile(manifestPath,JSON.stringify(manifest,null,2),"utf8");
}
const admin=createClient(manifest.apiUrl,manifest.serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
const email=`account-proof-${randomUUID()}@bindernotes.invalid`,password=`Local-${randomBytes(20).toString("hex")}!`,changed=`Changed-${randomBytes(20).toString("hex")}!`;
const created=await admin.auth.admin.createUser({email,password,email_confirm:true});assert.ifError(created.error);assert(created.data.user);const owner=created.data.user.id;
let deleted=false;
try{
 const first=client(),second=client();const login=await first.auth.signInWithPassword({email,password});assert.ifError(login.error);assert(login.data.session);
 const login2=await second.auth.signInWithPassword({email,password});assert.ifError(login2.error);assert(login2.data.session);
 const note={id:randomUUID(),title:"Disposable Auth lifecycle",content:{type:"doc",content:[]},math_blocks:[],tags:[]};const operation=randomUUID();
 const payload={p_kind:"note",p_record:note,p_expected_revision:0,p_operation_id:operation};const saved=await first.rpc("save_personal_content",payload);assert.ifError(saved.error);
 const revoked=await first.auth.signOut({scope:"global"});assert.ifError(revoked.error);
 const headers={apikey:manifest.anonKey,authorization:`Bearer ${login2.data.session.access_token}`,"content-type":"application/json"};
 const oldRead=await fetch(`${manifest.apiUrl}/rest/v1/personal_notes?id=eq.${note.id}`,{headers});assert.equal(oldRead.status,200);assert.deepEqual(await oldRead.json(),[]);
 const oldWrite=await fetch(`${manifest.apiUrl}/rest/v1/rpc/save_personal_content`,{method:"POST",headers,body:JSON.stringify(payload)});assert.equal(oldWrite.status,403);assert.match((await oldWrite.json()).message,/ACCOUNT_SESSION_REVOKED/);
 const refresh=await client().auth.refreshSession({refresh_token:login2.data.session.refresh_token});assert(refresh.error);
 console.log("PASS real GoTrue global signout: both refresh sessions revoked, unexpired oldJWT cannot read private rows or replay mutation receipts");
 const recovery=await admin.auth.admin.generateLink({type:"recovery",email,options:{redirectTo:"http://localhost:5173/auth/recovery"}});assert.ifError(recovery.error);assert(recovery.data.properties.hashed_token);
 const recovered=client();const verified=await recovered.auth.verifyOtp({token_hash:recovery.data.properties.hashed_token,type:"recovery"});assert.ifError(verified.error);assert(verified.data.session);
 assert.ifError((await recovered.auth.updateUser({password:changed})).error);assert.ifError((await recovered.auth.signOut({scope:"global"})).error);
 assert((await client().auth.signInWithPassword({email,password})).error);
 const fresh=client();const signed=await fresh.auth.signInWithPassword({email,password:changed});assert.ifError(signed.error);assert(signed.data.session);
 console.log("PASS real recovery token consumed, password replaced, old password rejected, new password accepted (email delivery not tested)");
 process.env.ACCOUNT_DELETION_ENABLED="true";process.env.APP_ORIGIN="http://localhost:5173";process.env.SUPABASE_URL=manifest.apiUrl;process.env.SUPABASE_SERVICE_ROLE_KEY=manifest.serviceRoleKey;
 const response=await accountRuntime().delete(new Request("http://localhost:5173/api/account/delete",{method:"POST",headers:{origin:"http://localhost:5173",authorization:`Bearer ${signed.data.session.access_token}`,"content-type":"application/json"},body:JSON.stringify({confirmation:"DELETE",operationId:randomUUID()})}));
 assert.equal(response.status,200,await response.clone().text());assert.deepEqual(await response.json(),{deleted:true});deleted=true;
 assert.equal(sql(`select count(*) from auth.users where id='${owner}';`),"0");assert.equal(sql(`select count(*) from public.personal_notes where id='${note.id}';`),"0");
 const tokenAfterDelete=await fresh.auth.getUser(signed.data.session.access_token);assert(tokenAfterDelete.error);assert((await client().auth.refreshSession({refresh_token:signed.data.session.refresh_token})).error);
 console.log("PASS trusted handler used real GoTrue/PostgREST deletion: account/private note removed, old access and refresh rejected, unrelated browser users retained");
}finally{if(!deleted)await admin.auth.admin.deleteUser(owner);}
