// SOURCE ENTRYPOINT FACTORY ONLY. Never imported by frontend; no automatic serving/deployment.
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { accessNeedsRefresh, refreshExpired, resolveCredentials, DISCOVERY_URLS, parseDiscovery, FALLBACK_ENDPOINTS, requestWithRetry, expectJson } from '../../../supabase/functions/_shared/qbo-oauth';
import { snapshotCanonical, initialSendMonth, batchDates, type Snapshot } from '../../../src/lib/billing-readiness';
import { concreteBillingBindings, type RpcGateway } from './supabase-bindings';
import { sourceAuthority } from './source';
import { serverAuthenticator } from './auth';
import { enrollmentService } from './enrollment';
import { executeInvoice, resumeDelivery, type Policy, type Approval, type Run } from './workflow';
import { billingProviders, boundedHttp, type Http } from './providers';
import type { EnrollmentScope } from '../../../src/lib/billing-enrollment';
export function createBillingApplication(options: {
  secret(name:string):string|undefined; fetch:Http;
  scope:Omit<EnrollmentScope,'clientId'>; allowedOrigins:string[];
}) {
  const {scope,secret}=options;
  const required=(name:string)=>{const value=secret(name);if(!value)throw new Error('backend_setup_pending');return value;};
  const url=required('SUPABASE_URL');
  const service=createClient(url,required('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
  const authClient=createClient(url,secret('SUPABASE_ANON_KEY')??required('SUPABASE_PUBLISHABLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
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
  async function policy():Promise<Policy>{
    const [{data:business,error:b},{data:a,error:e}]=await Promise.all([
      service.from('businesses').select('billing_mode').eq('id',scope.businessId).single(),
      service.from('qbo_billing_activation').select('*').eq('business_id',scope.businessId).eq('environment',scope.environment).eq('realm_id',scope.realmId).maybeSingle(),
    ]);
    if(b||e)throw new Error('backend_setup_pending');
    return {...scope,billingMode:business.billing_mode,invoiceEnabled:a?.invoice_enabled===true,announcementEnabled:a?.announcement_enabled===true,migrationVerified:a?.migration_verified===true,providerVerified:a?.provider_verified===true,deploymentVerified:a?.deployment_verified===true};
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
    const {data:members,error}=await service.from('qbo_billing_client_scope').select('client_id').eq('business_id',scope.businessId).eq('environment',scope.environment).eq('realm_id',scope.realmId).limit(1000);
    if(error)throw new Error('backend_setup_pending');if(members?.length===1000)throw new Error('roster_pagination_review_required');
    const rows=await Promise.all((members??[]).map(m=>source.preview(m.client_id,sendMonth)));
    return rows;
  }
  async function approve(credential:string,clientId:string,sendMonth:string,reviewedFingerprint:string){
    const actor=await admin(credential);const row=await source.preview(clientId,sendMonth);
    if(!row.snapshot||snapshotCanonical(row.snapshot)!==reviewedFingerprint)throw new Error('stale_approval');
    // SQL locks/rechecks real source inside the approval transaction, not cached preflight only.
    const approval=await query<Approval>('qbo_billing_approve_current',{...scoped,_client:clientId,_period:row.snapshot.servicePeriod,_snapshot:row.snapshot,_fingerprint:reviewedFingerprint,_actor:actor.id});
    if(!approval)throw new Error('approval_failed');return approval;
  }
  async function run(id:string){const {data,error}=await service.from('qbo_billing_runs').select('*').eq('id',id).eq('business_id',scope.businessId).eq('environment',scope.environment).eq('realm_id',scope.realmId).single();if(error||!data)throw new Error('cross_business');return data as {id:string;snapshot:Snapshot;request_id:string;provider_invoice_id:string|null;provider_outcomes:Record<string,{id:string}>;state:string};}
  const handler=async(request:Request)=>{
    const origin=request.headers.get('origin');const headers:Record<string,string>={'Content-Type':'application/json','Vary':'Origin'};
    if(origin){if(!options.allowedOrigins.includes(origin))return new Response('{}',{status:403});headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='authorization,apikey,content-type';headers['Access-Control-Allow-Methods']='POST,OPTIONS';}
    const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});if(request.method!=='POST')return reply({error:'method_not_allowed'},405);
    const credential=request.headers.get('authorization')??'';
    try{
      const body=z.object({action:z.string(),clientId:z.string().uuid().optional(),approvalId:z.string().uuid().optional(),runId:z.string().uuid().optional(),sendMonth:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),fingerprint:z.string().optional(),enabled:z.boolean().optional(),firstServicePeriod:z.string().nullable().optional(),expectedRevision:z.number().int().nonnegative().optional(),providerId:z.string().optional(),channel:z.enum(['sms','email']).optional(),customerId:z.string().regex(/^\d{1,20}$/).optional(),itemId:z.string().regex(/^\d{1,20}$/).optional(),incomeAccountId:z.string().regex(/^\d{1,20}$/).optional()}).strict().parse(await request.json());
      if(body.action==='schedule'){
        const actor=await authenticate(credential);if(actor?.kind!=='scheduler')throw new Error('unauthorized');const p=await policy();
        if(p.billingMode!=='qbo'||!p.invoiceEnabled||!p.migrationVerified||!p.deploymentVerified||!p.providerVerified)throw new Error('disabled');
        const dates=batchDates(initialSendMonth());if(new Date()<new Date(dates.sendAt)||initialSendMonth()!==dates.sendMonth)throw new Error('send_time_not_due');
        const {data:approvals,error}=await service.from('qbo_billing_approvals').select('id').eq('business_id',scope.businessId).eq('environment',scope.environment).eq('realm_id',scope.realmId).eq('service_period',dates.servicePeriod).limit(500);
        if(error)throw new Error('approval_read_failed');const results=[];for(const a of approvals??[])results.push(await executeInvoice({...bindings,provider:providers.provider},credential,a.id));return reply({results});
      }
      const actor=await admin(credential);
      if(body.action==='readiness')return reply({scope,policy:await policy(),rows:await roster(body.sendMonth??initialSendMonth())});
      if(body.action==='read_enrollment'&&body.clientId)return reply({scope,enrollment:await enrollment.read(credential,body.clientId)});
      if(body.action==='save_enrollment'&&body.clientId)return reply({enrollment:await enrollment.save(credential,{clientId:body.clientId,enabled:body.enabled,firstServicePeriod:body.firstServicePeriod,expectedRevision:body.expectedRevision})});
      if(body.action==='approve'&&body.clientId&&body.fingerprint)return reply({approval:await approve(credential,body.clientId,body.sendMonth??initialSendMonth(),body.fingerprint)});
      if(body.action==='execute'&&body.approvalId)return reply(await executeInvoice({...bindings,provider:providers.provider},credential,body.approvalId));
      if(body.action==='resume'&&body.approvalId)return reply({state:await resumeDelivery({...bindings,provider:providers.provider},credential,body.approvalId)});
      if(body.action==='runs'){const {data,error}=await service.from('qbo_billing_runs').select('id,state,provider_invoice_id,channels,code,audit_id').eq('business_id',scope.businessId).eq('environment',scope.environment).eq('realm_id',scope.realmId).limit(500);if(error)throw new Error('run_read_failed');return reply({runs:data});}
      if(body.runId&&['reconcile_invoice','reconcile_delivery','payment'].includes(body.action)){
        const r=await run(body.runId);
        if(body.action==='payment'){if(!r.provider_invoice_id)throw new Error('invoice_unavailable');return reply({payment:await providers.payment(r.snapshot,r.provider_invoice_id)});}
        if(!body.providerId)throw new Error('provider_evidence_required');
        const proof=body.action==='reconcile_invoice'?await providers.reconcileInvoice(r.snapshot,body.providerId,r.request_id):await providers.deliveryEvidence(r.snapshot,body.channel??'sms',body.providerId);
        const saved=await query<boolean>('qbo_billing_resolve_evidence',{...scoped,_id:r.id,_actor:actor.id,_kind:body.action==='reconcile_invoice'?'invoice':'delivery',_provider_id:body.providerId,_proof:{...proof,verified:true,runId:r.id}});if(saved!==true)throw new Error('reconciliation_failed');return reply({reconciled:true});
      }
      throw new Error('invalid_request');
    }catch(error){const code=error instanceof Error&&/^[a-z_]+$/.test(error.message)?error.message:'request_failed';return reply({error:code},code==='unauthorized'?401:code==='cross_business'?403:503);}
  };
  return {handler,source,bindings,providers,approve,enrollment};
}
