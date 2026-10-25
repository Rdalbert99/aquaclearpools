// Run after local-postgres.ts. Loopback synthetic fixtures only; concrete HTTP is mocked.
import {execFileSync,spawn} from 'node:child_process';
import {billingProviders} from '../server/providers';
import {readinessRow,snapshotCanonical,type Snapshot} from '../../../src/lib/billing-readiness';
import type {RpcGateway} from '../server/supabase-bindings';
const url='postgresql://nobody@127.0.0.1:55439/billing_contract';
const sql=(q:string)=>execFileSync('psql',[url,'-X','-v','ON_ERROR_STOP=1','-At','-c',q],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const lit=(v:unknown)=>`'${String(v).replace(/'/g,"''")}'`;
const json=(v:unknown)=>`${lit(JSON.stringify(v))}::jsonb`;
const b='a34bd007-c8b1-455c-8063-2ff0236e5181',c='031f318d-5df5-4295-aba2-415089197496',actor='00000000-0000-4000-8000-000000000001';
const scope=`'${b}','sandbox','123'`;
let count=0;const ok=(name:string)=>{count++;console.log('PASS '+name);};
const assert=(value:boolean,label:string)=>{if(!value)throw new Error(label);};
const denies=(q:string,code='permission denied')=>{try{sql(q);}catch(e){if(String((e as {stderr?:Buffer}).stderr).includes(code))return;throw e;}throw new Error('expected rejection '+q);};
const rpc:RpcGateway={rpc:async<T>(name,args)=>{try{const params=Object.entries(args).map(([k,v])=>`${k}=>${v===null?'NULL':typeof v==='object'?json(v):lit(v)}`).join(',');const raw=sql(`SET ROLE service_role;SELECT ${name}(${params})`).replace(/^SET\n/,'');return {data:(raw==='t'?true:raw==='f'?false:raw?JSON.parse(raw):null) as T,error:null};}catch{return {data:null,error:{message:'persistence_failed'}};}}};
// Role checks execute under actual PostgreSQL roles, not owner shortcuts.
for(const role of ['anon','authenticated','service_role']){
 denies(`SET ROLE ${role};SELECT * FROM qbo_billing_enrollment`);
 denies(`SET ROLE ${role};UPDATE qbo_billing_activation SET invoice_enabled=true`);
 denies(`SET ROLE ${role};SELECT qbo_billing_claim('00000000-0000-4000-8000-000000000000','${b}')`);
 denies(`SET ROLE ${role};SELECT qbo_billing_assert_run(${scope},'00000000-0000-4000-8000-000000000000')`);
 ok(`${role} denied direct tables and internal claim/assert bypass`);
}
for(const role of ['anon','authenticated']){denies(`SET ROLE ${role};SELECT qbo_billing_source(${scope},'${c}')`);denies(`SET ROLE ${role};SELECT qbo_billing_host_read(${scope},'policy')`);ok(`${role} denied scoped RPCs`);}
assert(sql(`SET ROLE service_role; SELECT qbo_billing_client_in_scope(${scope},'${c}')`).endsWith('t'),'service scoped read');ok('service role allowed only scoped gateway');
denies(`SET ROLE service_role;SELECT qbo_billing_source('${b}','production','999','${c}')`,'cross_business');ok('service cross-realm/client source denied');
sql(`UPDATE users SET status='revoked' WHERE id='${actor}'`);denies(`SET ROLE service_role;SELECT qbo_billing_set_enrollment(${scope},'${c}',false,NULL,3,'${actor}')`,'unauthorized');sql(`UPDATE users SET status='active' WHERE id='${actor}'`);ok('revoked admin rejected by definer');
sql(`DELETE FROM business_members WHERE user_id='${actor}'`);denies(`SET ROLE service_role;SELECT qbo_billing_set_enrollment(${scope},'${c}',false,NULL,3,'${actor}')`,'unauthorized');sql(`INSERT INTO business_members(business_id,user_id,role) VALUES('${b}','${actor}','owner')`);ok('revoked membership rejected by definer');
const get=()=>{const src=JSON.parse(sql(`SELECT qbo_billing_source(${scope},'${c}')`));const s=readinessRow(src.client,'2026-10',{businessId:b,environment:'sandbox',realmId:'123',...src}).snapshot;if(!s)throw new Error('fixture');return s;};
const s=get();const run=sql(`SELECT id FROM qbo_billing_runs WHERE client_id='${c}'`);
const raw={Id:'901',CustomerRef:{value:'114'},TotalAmt:200,Balance:200,DueDate:s.dueDate,TxnDate:'2026-10-26',PrivateNote:`Aqua Clear service ${s.serviceStart} through ${s.serviceEnd}; monthly`,InvoiceLink:'https://connect.intuit.com/pay/test',Line:[{Amount:200,DetailType:'SalesItemLineDetail',Description:`Pool service ${s.serviceStart} through ${s.serviceEnd}`,SalesItemLineDetail:{ItemRef:{value:'1'},TaxCodeRef:{value:'NON'}}}]};
let setup=false;let outcome:'reject'|'success'|'timeout'='reject';let sends=0;
const fetcher=async(u:string)=>{if(u.includes('telnyx')){sends++;if(outcome==='timeout')throw new Error('timeout');return outcome==='reject'?new Response('{}',{status:422}):new Response(JSON.stringify({data:{id:'synthetic-message',to:[{phone_number:'+16015550100'}]}}));}return new Response(JSON.stringify(u.includes('/query')?{QueryResponse:{Invoice:[raw]}}:{Invoice:raw}));};
const p=billingProviders({businessId:b,environment:'sandbox',realmId:'123',fetch:fetcher,secret:()=>setup?'synthetic-only':undefined,authorization:async()=>'synthetic-only',db:rpc});
const key=`${b}:sandbox:123:${c}:2026-11:monthly:sms`;
const resetFixture=()=>sql(`UPDATE qbo_billing_runs SET state='created',channels='{"sms":"pending"}',snapshot=${json(s)} WHERE id='${run}';UPDATE qbo_billing_config SET current_snapshot=${json(s)} WHERE client_id='${c}' AND service_period='2026-11'`);
resetFixture();assert(sql(`SET ROLE service_role;SELECT qbo_billing_channel_scoped(${scope},'${run}','sms')`).endsWith('t'),'claim');
assert(await p.provider.deliver(s,'901','sms',key)==='failed','missing setup outcome');assert(sends===0,'setup sent');assert(sql('SELECT count(*) FROM qbo_billing_delivery_attempts')==='0','setup reserved');ok('actual concrete adapter + SQL missing setup performs no transport or intent');
sql(`SELECT qbo_billing_update_run(${scope},'${run}','{"channel":"sms","channelState":"failed","state":"blocked"}')`);
assert(sql(`SELECT qbo_billing_resume_scoped(${scope},'${run}')`)==='t','resume');assert(sql(`SELECT qbo_billing_channel_scoped(${scope},'${run}','sms')`)==='t','reclaim');setup=true;
assert(await p.provider.deliver(s,'901','sms',key)==='failed','rejection');sql(`SELECT qbo_billing_update_run(${scope},'${run}','{"channel":"sms","channelState":"failed","state":"blocked"}')`);
assert(sql(`SELECT qbo_billing_resume_scoped(${scope},'${run}')`)==='t','retry resume');assert(sql(`SELECT qbo_billing_channel_scoped(${scope},'${run}','sms')`)==='t','retry claim');outcome='success';
assert(await p.provider.deliver(s,'901','sms',key)==='sent','successful retry');assert(sends===2,'wrong sends');assert(sql("SELECT string_agg(status,',' ORDER BY created_at) FROM qbo_billing_delivery_attempts")==='failed,sent','history');ok('actual adapter + SQL rejection retries successfully with retained separate attempt history');
// Uncertain attempt never becomes reusable, even with synthetic owner forcing channel state.
sql(`UPDATE qbo_billing_runs SET delivery_intents='{}',channels='{"sms":"sending"}' WHERE id='${run}'`);outcome='timeout';assert(await p.provider.deliver(s,'901','sms',key)==='unknown','timeout');sql(`SELECT qbo_billing_update_run(${scope},'${run}','{"channel":"sms","channelState":"unknown","state":"reconcile"}')`);assert(sql(`SELECT qbo_billing_resume_scoped(${scope},'${run}')`)==='f','unknown resume');ok('actual adapter + SQL timeout blocks resume');
// Concrete concurrency CAS after a proven failed attempt.
sql(`UPDATE qbo_billing_runs SET delivery_intents='{}',channels='{"sms":"sending"}',state='created' WHERE id='${run}'`);outcome='reject';assert(await p.provider.deliver(s,'901','sms',key)==='failed','rejection');sql(`SELECT qbo_billing_update_run(${scope},'${run}','{"channel":"sms","channelState":"failed","state":"blocked"}')`);
const parallel=(q:string)=>new Promise<string>((resolve,reject)=>{const child=spawn('psql',[url,'-X','-At','-v','ON_ERROR_STOP=1','-c',q]);let out='';let err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('exit',n=>n?reject(new Error(err)):resolve(out.trim()));});
const retries=await Promise.all([parallel(`SET ROLE service_role;SELECT qbo_billing_resume_scoped(${scope},'${run}')`),parallel(`SET ROLE service_role;SELECT qbo_billing_resume_scoped(${scope},'${run}')`)]);assert(retries.filter(x=>x.endsWith('t')).length===1,'double resume');ok('two concurrent real-role retries yield exactly one claim');
// Atomic profile/client request recovery includes exact UI fields and generated timestamps.
const payload={customer:'Synthetic created',pool_size:15000,pool_type:'Chlorine',contact_email:'created@example.test',contact_phone:'6015550123',contact_address:'Synthetic address',liner_type:'Liner',status:'Active',in_balance:false,user_id:null,service_rate:200,service_frequency:'weekly',next_service_date:null,included_services:['Chemical Testing'],service_notes:'synthetic',service_days:['Monday'],company_name:null,is_multi_property:false,join_date:'2026-10-25T12:00:00Z',created_at:'2026-10-25T12:00:00Z',updated_at:'2026-10-25T12:00:00Z'};
const account={email:'created@example.test',name:'Synthetic created',login:'synthetic-created',address_validated:false};const request=crypto.randomUUID();
const create=`SET ROLE service_role;SELECT qbo_billing_create_scoped_client(${scope},'${actor}',${json(payload)},'${request}',${json(account)})`;
const created=JSON.parse(sql(create).replace(/^SET\n/,''));const again=JSON.parse(sql(create).replace(/^SET\n/,''));assert(created.id===again.id&&!!created.user_id,'create recovery');assert(sql("SELECT count(*) FROM users WHERE login='synthetic-created'")==='1','duplicate profile');assert(sql("SELECT count(*) FROM clients WHERE customer='Synthetic created'")==='1','duplicate client');ok('real-schema actual insert fields + profile atomic creation and exact-ID repeated/reload recovery');
denies(`SET ROLE service_role;SELECT qbo_billing_create_scoped_client(${scope},'${actor}',${json({...payload,service_rate:201})},'${request}',${json(account)})`,'create_payload_changed');ok('changed recovery payload rejected without orphan');
denies(`SET ROLE service_role;SELECT qbo_billing_create_scoped_client(${scope},'${actor}',${json({...payload,id:crypto.randomUUID()})},'${crypto.randomUUID()}',${json({...account,login:'rollback-profile',email:'rollback@example.test'})})`,'invalid_client_field');assert(sql("SELECT count(*) FROM users WHERE login='rollback-profile'")==='0','orphan profile');ok('failed client insert rolls back earlier profile atomically');
denies(`SET ROLE service_role;SELECT qbo_billing_set_enrollment(${scope},'${created.id}',true,'invalid',0,'${actor}')`,'invalid_first_month');assert(sql(`SELECT count(*) FROM clients WHERE id='${created.id}'`)==='1','client lost');assert(sql(`SELECT count(*) FROM qbo_billing_enrollment WHERE client_id='${created.id}'`)==='0','false enrollment');ok('partial enrollment failure preserves one customer and default OFF');
// Frozen immutable announcement approval, authoritative channels and NULL activation.
const text='Aqua Clear Pools: Reviewed synthetic notice. Reply STOP to opt out.';const emailText='Reviewed synthetic notice.';const scopeId=crypto.randomUUID();
const approve=(channel:string,text:string,snap:unknown=s)=>`SET ROLE service_role;SELECT qbo_billing_approve_announcement(${scope},'${c}','${actor}','${scopeId}','${channel}',${lit(text)},${json(snap)})`;
assert(sql(approve('sms',text)).endsWith('t'),'sms approval');assert(sql(approve('email',emailText)).endsWith('t'),'email approval');sql(approve('sms',text));sql(approve('email',emailText));
assert(sql(`SELECT count(*) FROM qbo_billing_announcements WHERE client_id='${c}'`)==='2','duplicate announcement');
assert(sql(`SELECT approved_text FROM qbo_billing_announcements WHERE client_id='${c}' AND channel='email'`)===emailText,'email text modified');ok('channel-aware approval stores exact per-channel text once; email never carries the SMS wrapper');
denies(approve('sms','arbitrary text'),'announcement_review_required');
denies(approve('email','Reviewed notice. Reply STOP to opt out.'),'announcement_review_required');
denies(approve('sms',text,{...s,channels:['email']}),'announcement_review_required');
denies(approve('email',emailText,{...s,sendAt:'2026-10-27T17:00:00Z'}),'invalid_send_date');
denies(approve('sms','Aqua Clear Pools: Different wording. Reply STOP to opt out.'),'immutable_announcement');ok('announcement cannot authorize absent channel, arbitrary text/day, or rewrite an approved channel');
const announcement=sql(`SELECT id FROM qbo_billing_announcements WHERE client_id='${c}' AND channel='sms'`);
denies(`UPDATE qbo_billing_announcements SET channel='email' WHERE id='${announcement}'`,'immutable_announcement');ok('announcement row snapshot/text/channel/scope immutable');
sql(`DELETE FROM qbo_billing_activation`);denies(`SET ROLE service_role;SELECT qbo_billing_claim_announcement(${scope},'${announcement}')`,'disabled');ok('missing activation row announcement fails closed');
sql(`INSERT INTO sms_opt_outs(phone) VALUES('+16015550100')`);denies(`SET ROLE service_role;SELECT qbo_billing_claim_announcement(${scope},'${announcement}')`,'stale_source');sql('DELETE FROM sms_opt_outs');ok('new STOP insertion prevents announcement');
sql(`UPDATE qbo_billing_enrollment SET enabled=false WHERE client_id='${c}'`);denies(`SET ROLE service_role;SELECT qbo_billing_claim_announcement(${scope},'${announcement}')`,'stale_source');sql(`UPDATE qbo_billing_enrollment SET enabled=true WHERE client_id='${c}'`);ok('disabled enrollment prevents announcement');
const tax=s.provider;denies(`SET ROLE service_role;SELECT qbo_billing_verify_provider(${scope},${json({...tax,taxReview:undefined})},'${actor}')`,'tax_review_required');denies(`SET ROLE service_role;SELECT qbo_billing_verify_provider(${scope},${json({...tax,taxMode:'tax_inclusive'})},'${actor}')`,'tax_review_required');ok('real-role tax setup requires explicit attestation and rejects unsupported modes');

// Owner-only corruption fixture proves SQL does not authorize a stored mismatched channel.
sql(`ALTER TABLE qbo_billing_announcements DISABLE TRIGGER immutable_announcement;UPDATE qbo_billing_announcements SET snapshot=jsonb_set(snapshot,'{channels}','["email"]') WHERE id='${announcement}';ALTER TABLE qbo_billing_announcements ENABLE TRIGGER immutable_announcement`);
denies(`SET ROLE service_role;SELECT qbo_billing_claim_announcement(${scope},'${announcement}')`,'announcement_review_required');ok('stored SMS row with email-only snapshot is rejected by SQL');
// A final dispatch transaction independently checks newly inserted STOP after claim.
sql(`ALTER TABLE qbo_billing_announcements DISABLE TRIGGER immutable_announcement;UPDATE qbo_billing_announcements SET snapshot=${json(s)},state='sending' WHERE id='${announcement}';ALTER TABLE qbo_billing_announcements ENABLE TRIGGER immutable_announcement;INSERT INTO sms_opt_outs(phone) VALUES('+16015550100')`);
denies(`SET ROLE service_role;SELECT qbo_billing_announcement_dispatch(${scope},'${announcement}','sms',${lit(text)},${json(s)})`,'stale_source');sql('DELETE FROM sms_opt_outs');ok('final announcement dispatch rechecks STOP after earlier claim');
// Actual concurrent adapter invocation: one new attempt, one provider POST.
sql(`INSERT INTO qbo_billing_activation VALUES('${b}','sandbox','123',true,false,NULL,NULL,true,true,true);UPDATE qbo_billing_runs SET state='created',channels='{"sms":"sending"}',delivery_intents='{}' WHERE id='${run}';UPDATE qbo_billing_config SET current_snapshot=${json(s)} WHERE client_id='${c}'`);outcome='reject';assert(await p.provider.deliver(s,'901','sms',key)==='failed','fixture rejection');const before=sends;outcome='success';const results=await Promise.all([p.provider.deliver(s,'901','sms',key),p.provider.deliver(s,'901','sms',key)]);assert(results.filter(x=>x==='sent').length===1&&sends===before+1,'duplicate concrete retry sent');ok('concurrent concrete adapter retries plus SQL reserve exactly one provider POST');
// Mapping delta: audited atomic legacy+verified link with locked reviewed-identity comparison.
for(const role of ['anon','authenticated','service_role']){
 denies(`SET ROLE ${role};SELECT * FROM qbo_billing_mapping_audit`);
 denies(`SET ROLE ${role};TRUNCATE qbo_billing_mapping_audit`);
}
ok('mapping audit table has no direct runtime access for any role');
const mapClient='00000000-0000-4000-8000-000000000004';
sql(`INSERT INTO clients(id,customer,status,service_rate,contact_phone,contact_email,contact_address) VALUES('${mapClient}','Synthetic mapping','Active',200,'6015550102','mapping@example.test','1 Synthetic Way, Purvis MS 39475');
INSERT INTO qbo_billing_client_scope VALUES('${b}','sandbox','123','${mapClient}',false,now())`);
const mapSrc=JSON.parse(sql(`SELECT qbo_billing_source(${scope},'${mapClient}')`));
const mapApp={id:mapSrc.client.id,customer:mapSrc.client.customer,status:mapSrc.client.status,contact_email:mapSrc.client.contact_email??null,contact_phone:mapSrc.client.contact_phone??null,address:mapSrc.client.contact_address??null};
const mapEvidence={supported:true,active:true,evidence:[{field:'email',result:'match'}],displayName:'Synthetic mapping',app:mapApp,customer:{id:'116'}};
const confirm=(ev:unknown,cust='116',cli=mapClient,sc=scope,act=actor)=>`SET ROLE service_role;SELECT qbo_billing_confirm_mapping(${sc},'${cli}','${cust}','${act}',${json(ev)},'fp-synthetic')`;
denies(confirm(mapEvidence,'116',mapClient,scope,'00000000-0000-4000-8000-000000000002'),'unauthorized');ok('non-admin cannot confirm mapping');
denies(confirm(mapEvidence,'116',mapClient,`'${b}','production','999'`),'cross_business');ok('cross-scope mapping confirm rejected');
sql(`UPDATE clients SET contact_email='stale@example.test' WHERE id='${mapClient}'`);
denies(confirm(mapEvidence),'stale_identity_evidence');
assert(sql(`SELECT count(*) FROM client_qbo_links WHERE client_id='${mapClient}'`)==='0','half legacy write');
assert(sql(`SELECT count(*) FROM qbo_billing_verified_mapping WHERE client_id='${mapClient}'`)==='0','half verified write');
assert(sql(`SELECT count(*) FROM qbo_billing_mapping_audit WHERE client_id='${mapClient}'`)==='0','half audit write');
sql(`UPDATE clients SET contact_email='mapping@example.test' WHERE id='${mapClient}'`);
ok('stale app identity edit before confirm rejects with no half write');
assert(sql(confirm(mapEvidence)).endsWith('t'),'confirm mapping');
assert(sql(`SELECT count(*) FROM client_qbo_links WHERE client_id='${mapClient}' AND qbo_customer_id='116' AND linked_by='${actor}'`)==='1','legacy link');
assert(sql(`SELECT count(*) FROM qbo_billing_verified_mapping WHERE client_id='${mapClient}' AND customer_id='116'`)==='1','verified mapping');
assert(sql(`SELECT count(*) FROM qbo_billing_mapping_audit WHERE client_id='${mapClient}' AND actor='${actor}'`)==='1','audit row');
assert(sql(confirm(mapEvidence)).endsWith('t'),'idempotent confirm');
assert(sql(`SELECT count(*) FROM qbo_billing_mapping_audit WHERE client_id='${mapClient}'`)==='2','audit retained per confirmation');
ok('atomic legacy link + verified mapping + immutable audit in one transaction');
const mapClient2='00000000-0000-4000-8000-000000000005';
sql(`INSERT INTO clients(id,customer,status,service_rate) VALUES('${mapClient2}','Synthetic mapping two','Active',200);INSERT INTO qbo_billing_client_scope VALUES('${b}','sandbox','123','${mapClient2}',false,now())`);
const mapSrc2=JSON.parse(sql(`SELECT qbo_billing_source(${scope},'${mapClient2}')`));
const mapEvidence2={...mapEvidence,app:{id:mapSrc2.client.id,customer:mapSrc2.client.customer,status:mapSrc2.client.status,contact_email:mapSrc2.client.contact_email??null,contact_phone:mapSrc2.client.contact_phone??null,address:mapSrc2.client.contact_address??null}};
denies(confirm(mapEvidence2,'116',mapClient2),'mapping_conflict');ok('same QuickBooks customer cannot link to a second app customer');
console.log(`FINAL ${count} correction PostgreSQL/concrete-provider contracts passed`);
// Real SDK -> mocked PostgREST -> real disposable SQL: no production URLs or API acceptance.
const {createBillingApplication}=await import('../server/production');
const syntheticFetch=async(input:string|URL|Request,init?:RequestInit)=>{
 const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(u.hostname!=='synthetic.invalid')return fetcher(u.href);
 const respond=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 if(u.pathname==='/auth/v1/user')return respond({id:actor});
 if(u.pathname==='/rest/v1/users')return respond(JSON.parse(sql(`SELECT to_jsonb(x) FROM users x WHERE id='${actor}'`)));
 if(u.pathname==='/rest/v1/business_members')return respond({role:'owner'});
 if(u.pathname.startsWith('/rest/v1/rpc/')){const name=u.pathname.split('/').at(-1);if(!name||!/^qbo_billing_[a-z_]+$/.test(name))throw new Error('invalid fixture RPC');const args=JSON.parse(String(init?.body));const response=await rpc.rpc(name,args);return response.error?respond({message:response.error.message},400):respond(response.data);}
 throw new Error('unexpected synthetic SDK call');
};
const app=createBillingApplication({secret:n=>n==='SUPABASE_URL'?'https://synthetic.invalid':'synthetic-fixture-key',fetch:syntheticFetch,scope:{businessId:b,environment:'sandbox',realmId:'123'},allowedOrigins:[]});
const invoke=async(body:Record<string,unknown>)=>{const response=await app.handler(new Request('https://synthetic.invalid',{method:'POST',headers:{Authorization:'Bearer synthetic-admin','Content-Type':'application/json'},body:JSON.stringify(body)}));const data=await response.json() as Record<string,unknown>;if(response.status!==200)throw new Error(JSON.stringify(data));return data;};
const read=await invoke({action:'readiness',sendMonth:'2026-10'});const monthly=(read.rows as {client:{id:string};snapshot:Snapshot|null}[]).find(r=>r.client.id===c);assert(!!monthly?.snapshot,'SDK source preview');
if(!monthly?.snapshot)throw new Error('SDK fixture');await invoke({action:'approve',clientId:c,sendMonth:'2026-10',fingerprint:snapshotCanonical(monthly.snapshot)});
const reload=await invoke({action:'readiness',sendMonth:'2026-10'});assert((reload.approvals as {fingerprint:string}[]).some(a=>a.fingerprint===snapshotCanonical(monthly.snapshot as Snapshot)),'SDK persisted approval');ok('authenticated mocked SDK/PostgREST to real SQL readiness/approval/reload roundtrip');
const requestId=crypto.randomUUID();const newPayload={...payload,customer:'SDK synthetic created'};
const saved=await invoke({action:'create_client',scopeId:requestId,client:newPayload});const savedAgain=await invoke({action:'create_client',scopeId:requestId,client:newPayload});const id=(saved.client as {id:string}).id;assert(id===(savedAgain.client as {id:string}).id,'SDK duplicate');
await invoke({action:'register_new_client',clientId:id,enabled:false,firstServicePeriod:null,expectedRevision:0});const enrollment=await invoke({action:'read_enrollment',clientId:id});assert((enrollment.enrollment as {enabled:boolean;revision:number}).enabled===false,'SDK enrollment');ok('authenticated mocked SDK/PostgREST actual-ID create/retry/enrollment readback');
console.log(`FINAL ${count} correction PostgreSQL/concrete-provider/SDK contracts passed`);
