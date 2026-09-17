import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function runAccountCases({sql,as,json}) {
 const owner=randomUUID(),other=randomUUID(),note=randomUUID(),operation=randomUUID();
 sql(`insert into auth.users(id,email) values('${owner}','account-local@disposable.invalid'),('${other}','other-local@disposable.invalid');insert into auth.sessions(id,user_id) values('${owner}','${owner}'),('${other}','${other}');`);
 const record={id:note,title:'Private deletion fixture',content:{type:'doc',content:[]},math_blocks:[],tags:[]};
 const save=`select public.save_personal_content('note',${json(record)},0,'${operation}');`;
 as(owner,save);
 sql(`delete from auth.sessions where user_id='${owner}';`);
 assert.equal(as(owner,`select count(*) from public.personal_notes where id='${note}';`),'0');
 assert.throws(()=>as(owner,save),/ACCOUNT_SESSION_REVOKED/);
 assert.throws(()=>as(owner,`select public.reserve_user_asset('${randomUUID()}','No.pdf','application/pdf',10,'${'a'.repeat(64)}');`),/ACCOUNT_SESSION_REVOKED/);
 assert.equal(as(other,'select count(*) from public.profiles;'),'1');
 sql(`insert into auth.sessions(id,user_id) values('${owner}','${owner}');`);
 const deletion=randomUUID(),lease=randomUUID(),customer='cus_accountcase';
 const begin=`select public.begin_account_deletion('${owner}','${deletion}','${customer}','${lease}');`;
 assert.throws(()=>as(owner,begin),/permission denied/);
 assert.throws(()=>as(owner,`select public.account_deletion_state('${owner}');`),/permission denied/);
 as(null,`select public.bind_billing_customer('${owner}','${customer}');`,'service_role');
 assert.throws(()=>as(null,begin,'service_role'),/BILLING_LEASE_LOST/);
 assert.equal(as(null,`select public.claim_billing_event('${customer}','account-delete:${deletion}','${lease}');`,'service_role'),'claimed');
 assert.equal(as(null,`select public.claim_billing_event('${customer}','checkout','${randomUUID()}');`,'service_role'),'busy');
 as(null,begin,'service_role');as(null,begin,'service_role');
 assert.equal(as(null,`select public.account_deletion_state('${owner}');`,'service_role'),'t');
 assert.equal(as(owner,`select count(*) from public.personal_notes;`),'0');
 assert.throws(()=>as(owner,save),/ACCOUNT_SESSION_REVOKED/);
 assert.throws(()=>as(null,`select public.bind_billing_customer('${owner}','cus_duringdelete');`,'service_role'),/ACCOUNT_DELETING/);
 assert.equal(as(null,`select public.claim_billing_event('${customer}','checkout','${randomUUID()}');`,'service_role'),'busy');
 assert.equal(sql(`select count(*) from public.personal_notes where id='${note}';`),'1','Durable deletion marker must not prematurely erase data');
 // Actual Auth admin HTTP cascade is exercised separately; this proves schema FK behavior.
 sql(`delete from auth.users where id='${owner}';`);
 for (const table of ['profiles','personal_notes','billing_accounts']) assert.equal(sql(`select count(*) from public.${table} where ${table==='profiles'?'id':table==='billing_accounts'?'user_id':'owner_id'}='${owner}';`),'0');
 assert.equal(as(other,'select count(*) from public.profiles;'),'1');
 console.log('PASS real session-row revocation denies reads/RPC retries, deletion marker fences writes/new billing, lease proof, retry and account cascade isolation');
}
