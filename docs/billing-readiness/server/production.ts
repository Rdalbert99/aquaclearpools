// SOURCE ENTRYPOINT FACTORY ONLY. Never imported by frontend; no automatic serving/deployment.
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { accessNeedsRefresh, refreshExpired, resolveCredentials, DISCOVERY_URLS, parseDiscovery, FALLBACK_ENDPOINTS, requestWithRetry, expectJson, accountingUrl } from '../../../supabase/functions/_shared/qbo-oauth';
import { snapshotCanonical, initialSendMonth, batchDates, chicagoDate, type Snapshot } from '../../../src/lib/billing-readiness';
import { concreteBillingBindings, type RpcGateway } from './supabase-bindings';
import { sourceAuthority } from './source';
import { serverAuthenticator } from './auth';
import { enrollmentService } from './enrollment';
import { executeInvoice, resumeDelivery, type Policy, type Approval, type Run } from './workflow';
import { billingProviders, boundedHttp, type Http } from './providers';
import type { EnrollmentScope } from '../../../src/lib/billing-enrollment';
import { discoverProvider, readCustomer, searchCustomers, compareIdentity, customerFingerprint, type AppCustomer } from './setup';
export function createBillingApplication(options: {
  secret(name:string):string|undefined; fetch:Http;
  scope:Omit<EnrollmentScope,'clientId'>; allowedOrigins:string[];
}) {
  const {scope,secret}=options;
  const required=(name:string)=>{const value=secret(name);if(!value)throw new Error('backend_setup_pending');return value;};
  const url=required('SUPABASE_URL');
  const service=createClient(url,required('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:options.fetch}});
  const authClient=createClient(url,secret('SUPABASE_ANON_KEY')??required('SUPABASE_PUBLISHABLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:options.fetch}});
  const http=boundedHttp(options.fetch);
  async function query<T>(name:string,args:Record<string,unknown>):Promise<T|null>{const {data,error}=await service.rpc(name,args);if(error)throw new Error('persistence_failed');return data as T|null;}
  const scoped={_business:scope.businessId,_environment:scope.environment,_realm:scope.realmId};
  const authenticate=serverAuthenticator({
    getUser:async jwt=>{const {data,error}=await authClient.auth.getUser(jwt);return error?null:data.user;},
    adminBusiness:async id=>{
      const [{data:user,error:u},{data:member,error:m}]=await Promise.all([
        service.from('users').select('id,role,status').eq('id',id).maybeSingle(),
        service.from('business_members').select('role').eq('business_id',scope.businessId).eq('user_id',id).maybeSingle(),
      ]);
      return !u&&!m&&user?.role?.trim().toLowerCase()==='admin'&&user.status?.trim().toLowerCase()==='active'&&['admin','owner'].includes(member?.role?.trim().toLowerCase())?scope.businessId:null;
    },scheduler:secret('BILLING_SCHEDULER_SECRET')?{secret:required('BILLING_SCHEDULER_SECRET'),businessId:scope.businessId}:null,
  });
  const db:RpcGateway={rpc:async<T>(name,args)=>{try{return {data:await query<T>(name,args),error:null};}catch{return {data:null,error:{message:'persistence_failed'}};}}};
  const source=sourceAuthority(db,scope);
  async function hostRead<T>(kind:string,period?:string,id?:string){return query<T>('qbo_billing_host_read',{...scoped,_kind:kind,_period:period??null,_id:id??null});}
  async function policy():Promise<Policy>{
    const result=await hostRead<{billingMode:string;activation:Record<string,unknown>|null}>('policy');
    if(!result)throw new Error('backend_setup_pending');const a=result.activation;
    return {...scope,billingMode:result.billingMode,invoiceEnabled:a?.invoice_enabled===true,announcementEnabled:a?.announcement_enabled===true,migrationVerified:a?.migration_verified===true,providerVerified:a?.provider_verified===true,deploymentVerified:a?.deployment_verified===true};
  }
  // Single-process refresh coalescing; persisted optimistic CAS prevents overwrite by other workers.
  let refreshPromise:Promise<string>|null=null;
  async function authorization():Promise<string>{
    if(refreshPromise)return refreshPromise;
    const {data:conn,error}=await service.from('qbo_connections').select('*').eq('environment',scope.environment).eq('realm_id',scope.realmId).single();
    if(error||!conn||conn.needs_reconnect||refreshExpired(conn.refresh_expires_at))throw new Error('qbo_reconnect_required');
    if(!accessNeedsRefresh(conn.access_expires_at))return `Bearer ${conn.access_token}`;
    refreshPromise=(async()=>{
      const creds=resolveCredentials(scope.environment,secret);if(!creds)throw new Error('qbo_credentials_pending');
      let endpoints=FALLBACK_ENDPOINTS;
      try{endpoints=parseDiscovery(expectJson(await requestWithRetry(http,DISCOVERY_URLS[scope.environment],{}, {retry:true})))??endpoints;}catch{/* documented fixed Intuit fallback */}
      const token=expectJson(await requestWithRetry(http,endpoints.token_endpoint,{method:'POST',headers:{Authorization:`Basic ${btoa(`${creds.clientId}:${creds.clientSecret}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:conn.refresh_token})},{retry:false})) as {access_token?:string;refresh_token?:string;expires_in?:number;x_refresh_token_expires_in?:number};
      if(!token.access_token||!token.expires_in)throw new Error('qbo_refresh_failed');
      const {data:updated,error:write}=await service.from('qbo_connections').update({access_token:token.access_token,refresh_token:token.refresh_token??conn.refresh_token,access_expires_at:new Date(Date.now()+token.expires_in*1000).toISOString(),refresh_expires_at:token.x_refresh_token_expires_in?new Date(Date.now()+token.x_refresh_token_expires_in*1000).toISOString():conn.refresh_expires_at}).eq('id',conn.id).eq('environment',scope.environment).eq('realm_id',scope.realmId).eq('updated_at',conn.updated_at).select('id');
      if(write||updated?.length!==1)throw new Error('qbo_refresh_conflict');return `Bearer ${token.access_token}`;
    })();
    try{return await refreshPromise;}finally{refreshPromise=null;}
  }
  const bindings=concreteBillingBindings({db,scope,authenticate,policy,source:source.source});
  const enrollment=enrollmentService({authenticate,scope:async()=>scope,repository:bindings.repository,now:()=>new Date()});
  const providers=billingProviders({...scope,fetch:http,authorization,secret,db});
  async function admin(credential:string){const actor=await authenticate(credential);if(!actor||actor.kind!=='admin')throw new Error('unauthorized');return actor;}
  async function roster(sendMonth:string){
    const members=await hostRead<string[]>('roster');
    if(!members)throw new Error('backend_setup_pending');if(members.length>=1000)throw new Error('roster_pagination_review_required');
    const rows=[];for(const member of members??[]){
      const row=await source.preview(member,sendMonth);
      let balance: {status:'ok';invoices:unknown[]}|{status:'unavailable';reason:string}={status:'unavailable',reason:'Exact mapping/setup or enrollment blocked'};
      if(row.snapshot){try{const result=await providers.provider.balances(row.snapshot);if(!('invoices' in result)||!Array.isArray(result.invoices))throw new Error('balance_unavailable');balance={status:'ok',invoices:result.invoices};}catch{balance={status:'unavailable',reason:'QuickBooks balance read failed'};}}
      rows.push({...row,balance});
    } // bounded source lock queue
    return rows;
  }
  async function scopedAnnouncements(credential:string) {
    const actor=await authenticate(credential);if(actor?.kind!=='scheduler')throw new Error('unauthorized');
    const p=await policy();
    if(p.billingMode!=='qbo'||!p.migrationVerified||!p.deploymentVerified||!p.providerVerified||!p.announcementEnabled)throw new Error('announcement_setup_pending');
    // Dedicated approved announcement snapshot/text is required, not invoice content reused.
    // The concrete dispatcher below reads only immutable, reviewed recipient/message records.
    const rows=await query<{id:string;channel:'sms'|'email';snapshot:Snapshot;text:string}[]>('qbo_billing_due_announcements',scoped);
    const results=[];
    for(const row of rows??[]) {
      const authorized=await query<boolean>('qbo_billing_claim_announcement',{...scoped,_id:row.id});
      if(!authorized)continue;
      const outcome=await providers.sendAnnouncement(row.snapshot,row.channel,row.text,row.id);
      await query('qbo_billing_announcement_outcome',{...scoped,_id:row.id,_outcome:outcome});
      results.push({id:row.id,...outcome});
    }
    return results;
  }
  async function approve(credential:string,clientId:string,sendMonth:string,reviewedFingerprint:string){
    const actor=await admin(credential);const row=await source.preview(clientId,sendMonth);
    if(!row.snapshot||snapshotCanonical(row.snapshot)!==reviewedFingerprint)throw new Error('stale_approval');
    // SQL locks/rechecks real source inside the approval transaction, not cached preflight only.
    const approval=await query<Approval>('qbo_billing_approve_current',{...scoped,_client:clientId,_period:row.snapshot.servicePeriod,_snapshot:row.snapshot,_fingerprint:reviewedFingerprint,_actor:actor.id});
    if(!approval)throw new Error('approval_failed');return approval;
  }
  async function run(id:string){const data=await hostRead<{id:string;snapshot:Snapshot;request_id:string;provider_invoice_id:string|null;provider_outcomes:Record<string,{id:string}>;delivery_intents:Record<string,{correlation:string}>;state:string}>('run',undefined,id);if(!data)throw new Error('cross_business');return data;}
  const handler=async(request:Request)=>{
    const origin=request.headers.get('origin');const headers:Record<string,string>={'Content-Type':'application/json','Vary':'Origin'};
    if(origin){if(!options.allowedOrigins.includes(origin))return new Response('{}',{status:403});headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='authorization,apikey,content-type,x-client-info';headers['Access-Control-Allow-Methods']='POST,OPTIONS';}
    const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
    const credential=request.headers.get('authorization')??'';
    try{
      const body=z.object({action:z.string(),text:z.string().max(2000).optional(),scopeId:z.string().uuid().optional(),account:z.record(z.unknown()).optional(),client:z.record(z.unknown()).optional(),clientId:z.string().uuid().optional(),approvalId:z.string().uuid().optional(),runId:z.string().uuid().optional(),sendMonth:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),fingerprint:z.string().max(4000).optional(),search:z.string().max(60).optional(),confirmed:z.literal(true).optional(),enabled:z.boolean().optional(),firstServicePeriod:z.string().nullable().optional(),expectedRevision:z.number().int().nonnegative().optional(),providerId:z.string().optional(),channel:z.enum(['sms','email']).optional(),customerId:z.string().regex(/^\d{1,20}$/).optional(),itemId:z.string().regex(/^\d{1,20}$/).optional(),incomeAccountId:z.string().regex(/^\d{1,20}$/).optional(),taxReview:z.object({confirmed:z.literal(true),taxMode:z.literal('non_taxable'),taxCode:z.literal('NON')}).strict().optional()}).strict().parse(await request.json());
      if(body.action==='schedule'){
        const actor=await authenticate(credential);if(actor?.kind!=='scheduler')throw new Error('unauthorized');const p=await policy();
        if(p.billingMode!=='qbo'||!p.invoiceEnabled||!p.migrationVerified||!p.deploymentVerified||!p.providerVerified)throw new Error('disabled');
        const dates=batchDates(initialSendMonth());if(new Date()<new Date(dates.sendAt)||chicagoDate()!==dates.sendDay)throw new Error('send_time_not_due');
        const approvals=await hostRead<{id:string}[]>('approvals',dates.servicePeriod);if(!approvals)throw new Error('approval_read_failed');if(approvals.length>=500)throw new Error('approval_pagination_review_required');const results=[];for(const a of approvals)results.push(await executeInvoice({...bindings,provider:providers.provider},credential,a.id));return reply({results});
      }
      if(body.action==='schedule_announcements')return reply({results:await scopedAnnouncements(credential)});
      const actor=await admin(credential);
      if(body.action==='create_client'&&body.client&&body.scopeId)return reply({client:await query('qbo_billing_create_scoped_client',{...scoped,_actor:actor.id,_client:body.client,_request_id:body.scopeId,_account:body.account??null})});
      if(body.action==='register_new_client'&&body.clientId){
        await query('qbo_billing_register_new_client',{...scoped,_client:body.clientId,_actor:actor.id});
        return reply({enrollment:await enrollment.save(credential,{clientId:body.clientId,enabled:body.enabled,firstServicePeriod:body.firstServicePeriod,expectedRevision:body.expectedRevision})});
      }
      if(body.action==='verify_mapping'&&body.clientId&&body.customerId){
        await enrollment.read(credential,body.clientId); // checks explicit reviewed scope first
        const data=expectJson(await requestWithRetry(http,accountingUrl(scope.environment,scope.realmId,`/customer/${body.customerId}`),{headers:{Authorization:await authorization(),Accept:'application/json'}},{retry:true})) as {Customer?:{Id?:string;Active?:boolean}};
        if(data.Customer?.Id!==body.customerId||data.Customer.Active===false)throw new Error('mapping_verification_failed');
        return reply({verified:await query('qbo_billing_verify_mapping',{...scoped,_client:body.clientId,_customer:body.customerId,_actor:actor.id})});
      }
      // GET-only setup reads; minimum safe fields; never tokens.
      const qboGet=async(path:string)=>expectJson(await requestWithRetry(http,accountingUrl(scope.environment,scope.realmId,path),{method:'GET',headers:{Authorization:await authorization(),Accept:'application/json'}},{retry:true})) as Record<string,any>;
      const appCustomer=async(clientId:string):Promise<AppCustomer>=>{
        await enrollment.read(credential,clientId); // explicit reviewed business scope (no IDOR)
        const {data,error}=await service.from('clients').select('id,customer,status,contact_email,contact_phone,contact_address').eq('id',clientId).maybeSingle();
        if(error||!data)throw new Error('cross_business');return {...data,address:data.contact_address} as AppCustomer;
      };
      if(body.action==='discover_provider'&&body.itemId)return reply({scope,provider:await discoverProvider(qboGet,scope.realmId,body.itemId)});
      if(body.action==='verify_provider'&&body.itemId){
        if(!body.taxReview)throw new Error('tax_review_required');
        if(!body.fingerprint)throw new Error('provider_evidence_required');
        const live=await discoverProvider(qboGet,scope.realmId,body.itemId); // re-read on save
        if(live.fingerprint!==body.fingerprint)throw new Error('stale_provider_evidence');
        if(!live.taxSupported)throw new Error('provider_setup_review_required');
        if(body.incomeAccountId&&body.incomeAccountId!==live.item.incomeAccountId)throw new Error('stale_provider_evidence');
        const incomeAccountId=live.item.incomeAccountId;const revision=crypto.randomUUID();
        return reply({verified:await query('qbo_billing_verify_provider',{...scoped,_actor:actor.id,_setup:{itemId:body.itemId,incomeAccountId,taxCode:body.taxReview.taxCode,taxMode:body.taxReview.taxMode,verified:true,revision,taxReview:{confirmed:true,actor:actor.id,reviewedAt:new Date().toISOString(),revision,itemId:body.itemId,incomeAccountId}}})});
      }
      if(body.action==='discover_customer'&&body.clientId&&(body.customerId||body.search)){
        const app=await appCustomer(body.clientId);
        if(body.search)return reply({scope,app,leads:await searchCustomers(qboGet,body.search)}); // leads only, never linked
        const qb=await readCustomer(qboGet,body.customerId as string);
        return reply({scope,app,customer:qb,comparison:compareIdentity(app,qb),fingerprint:customerFingerprint(scope.realmId,app,qb)});
      }
      if(body.action==='confirm_mapping'&&body.clientId&&body.customerId&&body.fingerprint&&body.confirmed){
        const app=await appCustomer(body.clientId);const qb=await readCustomer(qboGet,body.customerId); // live re-read
        const comparison=compareIdentity(app,qb);
        if(customerFingerprint(scope.realmId,app,qb)!==body.fingerprint)throw new Error('stale_identity_evidence');
        if(!comparison.supported)throw new Error('identity_review_required');
        return reply({verified:await query('qbo_billing_confirm_mapping',{...scoped,_client:body.clientId,_customer:body.customerId,_actor:actor.id,_evidence:{supported:true,active:qb.active,evidence:comparison.evidence,displayName:qb.displayName,app:{id:app.id,customer:app.customer,status:app.status,contact_email:app.contact_email??null,contact_phone:app.contact_phone??null,address:app.address??null},customer:qb},_fingerprint:body.fingerprint})});
      }
      if(body.action==='readiness'){const month=body.sendMonth??initialSendMonth();const approvals=await hostRead('approvals',batchDates(month).servicePeriod);return reply({scope,sendMonth:month,policy:await policy(),rows:await roster(month),approvals});}
      if(body.action==='policy')return reply({policy:await policy()});
      if(body.action==='read_enrollment'&&body.clientId)return reply({scope,enrollment:await enrollment.read(credential,body.clientId)});
      if(body.action==='save_enrollment'&&body.clientId)return reply({enrollment:await enrollment.save(credential,{clientId:body.clientId,enabled:body.enabled,firstServicePeriod:body.firstServicePeriod,expectedRevision:body.expectedRevision})});
      if(body.action==='approve'&&body.clientId&&body.fingerprint)return reply({approval:await approve(credential,body.clientId,body.sendMonth??initialSendMonth(),body.fingerprint)});
      if(body.action==='approve_announcement'&&body.clientId&&body.scopeId&&body.channel&&body.text&&body.fingerprint){
        if(body.channel!=='sms'&&body.channel!=='email')throw new Error('announcement_review_required');
        if(body.channel==='sms'&&(!body.text.startsWith('Aqua Clear Pools:')||!body.text.endsWith('Reply STOP to opt out.')))throw new Error('announcement_review_required');
        if(body.channel==='email'&&body.text.includes('Reply STOP to opt out.'))throw new Error('announcement_review_required'); // SMS wrapper never stored on email
        const row=await source.preview(body.clientId,body.sendMonth??initialSendMonth());
        if(!row.snapshot||snapshotCanonical(row.snapshot)!==body.fingerprint)throw new Error('stale_approval');
        if(!row.snapshot.channels.includes(body.channel))throw new Error('announcement_review_required');
        return reply({approved:await query('qbo_billing_approve_announcement',{...scoped,_client:body.clientId,_actor:actor.id,_scope_id:body.scopeId,_channel:body.channel,_text:body.text,_snapshot:row.snapshot})});
      }
      if(body.action==='execute'&&body.approvalId)return reply(await executeInvoice({...bindings,provider:providers.provider},credential,body.approvalId));
      if(body.action==='resume'&&body.approvalId)return reply({state:await resumeDelivery({...bindings,provider:providers.provider},credential,body.approvalId)});
      if(body.action==='runs'){const runs=await hostRead<unknown[]>('runs',batchDates(body.sendMonth??initialSendMonth()).servicePeriod);if(!runs)throw new Error('run_read_failed');if(runs.length>=500)throw new Error('run_pagination_review_required');return reply({runs});}
      if(body.runId&&['reconcile_invoice','reconcile_delivery','payment'].includes(body.action)){
        const r=await run(body.runId);
        if(body.action==='payment'){if(!r.provider_invoice_id)throw new Error('invoice_unavailable');return reply({payment:await providers.payment(r.snapshot,r.provider_invoice_id)});}
        if(!body.providerId)throw new Error('provider_evidence_required');
        const proof=body.action==='reconcile_invoice'?await providers.reconcileInvoice(r.snapshot,body.providerId,r.request_id):await providers.deliveryEvidence(r.snapshot,body.channel??'sms',body.providerId,r.delivery_intents[body.channel??'sms']?.correlation);
        const saved=await query<boolean>('qbo_billing_resolve_evidence',{...scoped,_id:r.id,_actor:actor.id,_kind:body.action==='reconcile_invoice'?'invoice':'delivery',_provider_id:body.providerId,_proof:{...proof,verified:true,runId:r.id}});if(saved!==true)throw new Error('reconciliation_failed');return reply({reconciled:true});
      }
      throw new Error('invalid_request');
    }catch(error){const code=error instanceof Error&&/^[a-z_]+$/.test(error.message)?error.message:'request_failed';return reply({error:code},code==='unauthorized'?401:code==='cross_business'?403:503);}
  };
  return {handler,source,bindings,providers,approve,enrollment};
}
