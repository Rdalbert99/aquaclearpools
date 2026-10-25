import { accountingUrl, expectJson, requestWithRetry, type QboEnv } from '../../../supabase/functions/_shared/qbo-oauth';
import { normalizeOpenInvoices } from '../../../supabase/functions/_shared/qbo-balance';
import { accountSummary, balanceDraftLines } from '../../../src/lib/account-balance';
import { chicagoDate, type Snapshot, type SendChannel, reviewedNonTaxable } from '../../../src/lib/billing-readiness';
import { qboReadAdapter } from './qbo-reads';
import type { Provider, ProviderInvoice, InvoicePayload } from './workflow';
import type { RpcGateway } from './supabase-bindings';
export type Http = (url: string, init?: RequestInit) => Promise<Response>;
const digestText=async(text:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export function boundedHttp(fetcher: Http): Http {
  return async (url, init) => {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !['quickbooks.api.intuit.com','sandbox-quickbooks.api.intuit.com','oauth.platform.intuit.com','developer.intuit.com','api.telnyx.com','api.mailjet.com'].includes(u.hostname)) throw new Error('unsafe_provider_host');
    const response = await fetcher(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(20000) });
    return response;
  };
}
export function validatedPaymentLink(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try { const u = new URL(raw); return u.protocol === 'https:' && !u.username && !u.password && ['connect.intuit.com','payment.quickbooks.intuit.com','pay.quickbooks.intuit.com'].includes(u.hostname) ? u.href : null; } catch { return null; }
}
interface QInvoice { Id?: string; CustomerRef?: { value?: string }; TotalAmt?: number; Balance?: number; DueDate?: string; TxnDate?: string; PrivateNote?: string; InvoiceLink?: string; Line?: { Amount?: number; DetailType?:string; Description?: string; SalesItemLineDetail?: { ItemRef?: { value?: string }; TaxCodeRef?: { value?: string } } }[] }
export function verifiedInvoice(raw: QInvoice | undefined, s: Snapshot, requestId?: string): ProviderInvoice {
  const marker = `Aqua Clear service ${s.serviceStart} through ${s.serviceEnd}; ${s.frequency}`;
  if (!raw?.Id || !/^\d+$/.test(raw.Id) || raw.CustomerRef?.value !== s.customerId || raw.DueDate !== s.dueDate || raw.TxnDate !== s.sendAt.slice(0,10) ||
    Math.round(Number(raw.TotalAmt)*100) !== s.amountCents || !raw.PrivateNote?.startsWith(marker) ||
    (requestId && raw.PrivateNote !== `${marker}; billing-run:${requestId}`)) throw new Error('provider_result_mismatch');
  const chargeLines=raw.Line?.filter(l=>l.DetailType!=='SubTotalLineDetail');
  const charge=chargeLines?.[0];
  if(chargeLines?.length!==1||charge?.DetailType!=='SalesItemLineDetail'||!Number.isFinite(charge.Amount)||Math.round(Number(charge.Amount)*100)!==s.amountCents||charge.Description!==`Pool service ${s.serviceStart} through ${s.serviceEnd}`||charge.SalesItemLineDetail?.ItemRef?.value!==s.provider.itemId||charge.SalesItemLineDetail?.TaxCodeRef?.value!==s.provider.taxCode)throw new Error('provider_result_mismatch');
  return { id: raw.Id, customerId: s.customerId, amountCents: s.amountCents, dueDate: raw.DueDate, serviceStart: s.serviceStart, serviceEnd: s.serviceEnd, frequency: s.frequency };
}
export function billingProviders(deps: {
  environment: QboEnv; realmId: string; businessId: string; fetch: Http; authorization(): Promise<string>;
  secret(name: string): string | undefined; db: RpcGateway;
}) {
  const http = boundedHttp(deps.fetch);
  const scope = { _business: deps.businessId, _environment: deps.environment, _realm: deps.realmId };
  async function qbo(s: Snapshot, path: string, method = 'GET', body?: unknown) {
    if (s.businessId !== deps.businessId || s.environment !== deps.environment || s.realmId !== deps.realmId) throw new Error('cross_realm');
    return expectJson(await requestWithRetry(http, accountingUrl(s.environment,s.realmId,path), { method,
      headers: { Authorization: await deps.authorization(), Accept: 'application/json', 'Content-Type':'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}) }, { retry: method==='GET' })) as Record<string, unknown>;
  }
  const reads = qboReadAdapter({ ...deps, fetch: http, verifyTax: async s => {
    const data = await qbo(s, `/companyinfo/${s.realmId}`);
    const company = data.CompanyInfo as { Country?: string } | undefined;
    // Concrete conservative US non-taxable configuration. Taxable/inclusive setup is a visible gate.
    return company?.Country === 'US' && reviewedNonTaxable(s.provider);
  } });
  async function invoice(s: Snapshot, id: string) {
    if (!/^\d+$/.test(id)) throw new Error('invalid_provider_id');
    const data = await qbo(s, `/invoice/${id}?include=invoiceLink`);
    const raw = data.Invoice as QInvoice | undefined;
    if (raw?.Id !== id || raw.CustomerRef?.value !== s.customerId || !Number.isFinite(raw.Balance)) throw new Error('invoice_read_unavailable');
    return raw;
  }
  async function notice(s: Snapshot, id: string) {
    const raw = await invoice(s,id); verifiedInvoice(raw,s);
    const link = validatedPaymentLink(raw.InvoiceLink);
    if (!link) throw new Error('official_payment_link_unavailable');
    const balances = await reads.balances(s);
    const summary = accountSummary(s.amountCents, {status:'ok',invoices:balances.invoices}, chicagoDate(), id);
    const amount = (s.amountCents/100).toFixed(2);
    return { text: `Aqua Clear Pools: ${s.frequency} service ${s.serviceStart}–${s.serviceEnd}. New invoice $${amount}, due ${s.dueDate}.${balanceDraftLines(summary)} Pay/view this invoice: ${link}. Reply STOP to opt out.`, raw, summary };
  }
  async function external(url: string, init: RequestInit) {
    const response = await http(url,init);
    if (!response.ok) throw new Error([400,401,403,404,422].includes(response.status) ? 'provider_rejected' : 'provider_unknown');
    const text = await response.text();
    // Mailjet numeric IDs may exceed JS precision. Preserve identifiers before parsing.
    return JSON.parse(text.replace(/("(?:MessageID|ID|Message)"\s*:\s*)(\d{16,})(?=\s*[,}])/g, '$1"$2"')) as Record<string, unknown>;
  }
  const provider: Provider = {
    verifySetup: reads.verifySetup, balances: reads.balances,
    existing: async s => {
      const lookup = await reads.existing(s);
      // Manually-created invoices, even paid, require operator proof. Never automatically adopt description-only matches.
      return lookup.exact.length ? {status:'ambiguous',exact:lookup.exact} : lookup;
    },
    create: async (s: Snapshot, payload: InvoicePayload, requestId: string) => {
      if (!/^[a-zA-Z0-9-]{1,50}$/.test(requestId)) throw new Error('invalid_request_id');
      const data = await qbo(s, `/invoice?requestid=${encodeURIComponent(requestId)}`, 'POST', {...payload,PrivateNote:`${payload.PrivateNote}; billing-run:${requestId}`});
      return verifiedInvoice(data.Invoice as QInvoice,s,requestId);
    },
    deliver: async (s, id, channel, key) => {
      let providerId: string | null = null;
      let runId: string | null = null;
      let reserved = false;
      const attempt = crypto.randomUUID();
      try {
        // Validate channel and sender setup before reserving any external attempt.
        if (!s.channels.includes(channel)) throw new Error('channel_mismatch');
        const digits=(s.contactPhone??'').replace(/\D/g,'');
        const to=digits.length===10?`+1${digits}`:digits.length===11&&digits.startsWith('1')?`+${digits}`:null;
        const smsKey=channel==='sms'?deps.secret('TELNYX_API_KEY'):undefined;
        const emailKey=channel==='email'?deps.secret('MAILJET_API_KEY'):undefined;
        const emailSecret=channel==='email'?deps.secret('MAILJET_API_SECRET'):undefined;
        if(channel==='sms'&&(!smsKey||!to))throw new Error('sms_setup');
        if(channel==='email'&&(!emailKey||!emailSecret||!s.contactEmail))throw new Error('email_setup');
        const {text}=await notice(s,id);
        const run=await deps.db.rpc<{id:string}>('qbo_billing_find_run',{...scope,_slot:key.replace(/:(monthly|annual):(sms|email)$/,'')});
        if(!run.data?.id)throw new Error('persistence_failed'); runId=run.data.id;
        const intent=await deps.db.rpc<boolean>('qbo_billing_delivery_intent',{...scope,_id:runId,_channel:channel,_text_hash:await digestText(text),_correlation:attempt,_attempt:attempt});
        if(intent.error||intent.data!==true)throw new Error('persistence_failed'); reserved=true;
        if(channel==='sms'){
          const response=await external('https://api.telnyx.com/v2/messages',{method:'POST',headers:{Authorization:`Bearer ${smsKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:'+16014198527',to,text})});
          const data=response.data as {id?:string;to?:{phone_number?:string;status?:string}[]}|undefined;
          if(!data?.id||data.to?.length!==1||data.to[0].phone_number!==to)throw new Error('provider_unknown'); providerId=data.id;
        }else{
          const response=await external('https://api.mailjet.com/v3.1/send',{method:'POST',headers:{Authorization:`Basic ${btoa(`${emailKey}:${emailSecret}`)}`,'Content-Type':'application/json'},body:JSON.stringify({Messages:[{From:{Email:'randy@getaquaclear.com',Name:'Aqua Clear Pools'},To:[{Email:s.contactEmail}],Subject:`Aqua Clear Pools invoice due ${s.dueDate}`,TextPart:text,CustomID:attempt}]})});
          const messages=response.Messages as {Status?:string;To?:{MessageUUID?:string;MessageID?:string|number}[]}[]|undefined;
          if(messages?.length===1&&messages[0].Status==='error'&&!messages[0].To?.length)throw new Error('provider_rejected');
          if(messages?.length!==1||messages[0].Status!=='success'||messages[0].To?.length!==1||!messages[0].To[0].MessageUUID)throw new Error('provider_unknown');
          const numericId=messages[0].To[0].MessageID;
          if(!/^\d+$/.test(String(numericId))||(typeof numericId==='number'&&!Number.isSafeInteger(numericId)))throw new Error('provider_unknown');
          providerId=`${messages[0].To[0].MessageUUID}:${numericId}`;
        }
        const saved=await deps.db.rpc<boolean>('qbo_billing_attempt_outcome',{...scope,_id:runId,_channel:channel,_attempt:attempt,_provider_id:providerId,_status:'sent',_proof:'provider_acceptance'});
        if(saved.error||saved.data!==true)throw new Error('persistence_failed');return 'sent';
      }catch(error){
        const code=error instanceof Error?error.message:'';
        if(reserved&&runId){
          const status=code==='provider_rejected'&&!providerId?'failed':'unknown';
          const saved=await deps.db.rpc<boolean>('qbo_billing_attempt_outcome',{...scope,_id:runId,_channel:channel,_attempt:attempt,_provider_id:providerId,_status:status,_proof:status==='failed'?'provider_rejected':'uncertain'});
          return !saved.error&&saved.data===true?status:'unknown';
        }
        return ['sms_setup','email_setup','channel_mismatch','official_payment_link_unavailable'].includes(code)?'failed':'unknown';
      }
    },
  };
  return { provider, invoice, notice,
    sendAnnouncement: async (s:Snapshot,channel:SendChannel,text:string,announcementId:string):Promise<{status:'sent'|'failed'|'unknown';providerId:string|null}> => {
      try {
        if(s.businessId!==deps.businessId||s.environment!==deps.environment||s.realmId!==deps.realmId||!s.channels.includes(channel))throw new Error('channel_mismatch');
        if(!text||text.length>2000||(channel==='sms'&&!/Reply STOP to opt out\./i.test(text)))throw new Error('invalid_announcement');
        const dispatch=async()=>{const result=await deps.db.rpc<boolean>('qbo_billing_announcement_dispatch',{...scope,_id:announcementId,_channel:channel,_text:text,_snapshot:s});if(result.error||result.data!==true)throw new Error('announcement_guard');};
        if(channel==='sms'){
          const digits=(s.contactPhone??'').replace(/\D/g,'');const to=digits.length===10?`+1${digits}`:digits.length===11&&digits.startsWith('1')?`+${digits}`:null;
          const key=deps.secret('TELNYX_API_KEY');if(!to||!key)throw new Error('sms_setup');
          await dispatch();
          const result=await external('https://api.telnyx.com/v2/messages',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from:'+16014198527',to,text})});
          const data=result.data as {id?:string;to?:{phone_number?:string}[]}|undefined;
          if(!data?.id||data.to?.length!==1||data.to[0].phone_number!==to)throw new Error('provider_unknown');return {status:'sent',providerId:data.id};
        }
        const key=deps.secret('MAILJET_API_KEY'),secret=deps.secret('MAILJET_API_SECRET');if(!key||!secret||!s.contactEmail)throw new Error('email_setup');
        await dispatch();
        const response=await external('https://api.mailjet.com/v3.1/send',{method:'POST',headers:{Authorization:`Basic ${btoa(`${key}:${secret}`)}`,'Content-Type':'application/json'},body:JSON.stringify({Messages:[{From:{Email:'randy@getaquaclear.com',Name:'Aqua Clear Pools'},To:[{Email:s.contactEmail}],Subject:'Aqua Clear Pools billing notice',TextPart:text}]})});
        const rows=response.Messages as {Status?:string;To?:{MessageUUID?:string}[]}[]|undefined;
        if(rows?.length!==1||rows[0].Status!=='success'||rows[0].To?.length!==1||!rows[0].To[0].MessageUUID)throw new Error('provider_unknown');return {status:'sent',providerId:rows[0].To[0].MessageUUID};
      }catch(error){return {status:error instanceof Error&&['sms_setup','email_setup','invalid_announcement','provider_rejected','channel_mismatch','announcement_guard'].includes(error.message)?'failed':'unknown',providerId:null};}
    },
    reconcileInvoice: async (s: Snapshot,id: string,requestId:string) => verifiedInvoice(await invoice(s,id),s,requestId),
    payment: async (s: Snapshot,id:string) => { const raw=await invoice(s,id); return {invoiceId:id,customerId:s.customerId,balanceCents:Math.round(Number(raw.Balance)*100),totalCents:Math.round(Number(raw.TotalAmt)*100),readAt:new Date().toISOString()}; },
    deliveryEvidence: async (s:Snapshot,channel:SendChannel,id:string,correlation?:string) => {
      if (channel==='email') {
        const [uuid,numericId]=id.split(':');
        const key=deps.secret('MAILJET_API_KEY'),secret=deps.secret('MAILJET_API_SECRET');
        if(!key||!secret||!uuid||!/^\d+$/.test(numericId??''))throw new Error('email_evidence_setup');
        const headers={Authorization:`Basic ${btoa(`${key}:${secret}`)}`};
        const record=await external(`https://api.mailjet.com/v3/REST/message/${numericId}`,{headers});
        const rows=record.Data as {ID?:string|number;ContactID?:number;Status?:string}[]|undefined;
        if(rows?.length!==1||String(rows[0].ID)!==numericId||!correlation)throw new Error('evidence_mismatch');
        const correlated=await external(`https://api.mailjet.com/v3/REST/message?CustomID=${encodeURIComponent(correlation)}`,{headers});
        const matching=correlated.Data as {ID?:string|number}[]|undefined;
        if(matching?.length!==1||String(matching[0].ID)!==numericId)throw new Error('evidence_mismatch');
        if(!rows[0].ContactID)throw new Error('recipient_evidence_pending');
        const contact=await external(`https://api.mailjet.com/v3/REST/contact/${rows[0].ContactID}`,{headers});
        const contacts=contact.Data as {Email?:string}[]|undefined;
        if(contacts?.length!==1||contacts[0].Email?.toLowerCase()!==s.contactEmail?.toLowerCase())throw new Error('evidence_mismatch');
        const history=await external(`https://api.mailjet.com/v3/REST/messagehistory/${numericId}`,{headers});
        const events=history.Data as {EventType?:string;EventAt?:number}[]|undefined;
        if(!Array.isArray(events))throw new Error('delivery_evidence_pending');
        const kinds=events.map(e=>(e.EventType??'').toLowerCase());
        if(kinds.some(k=>['bounced','blocked'].includes(k)))return {status:'failed',channel,providerId:id,correlation};
        if(kinds.includes('sent'))return {status:'sent',channel,providerId:id,correlation};
        throw new Error('delivery_evidence_pending');
      }
      const token=deps.secret('TELNYX_API_KEY'); if(!token || !/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('sms_setup');
      const data=await external(`https://api.telnyx.com/v2/messages/${id}`,{headers:{Authorization:`Bearer ${token}`}});
      const message=data.data as {id?:string;direction?:string;text?:string;from?:{phone_number?:string};to?:{phone_number?:string;status?:string}[]} | undefined;
      const digits=(s.contactPhone??'').replace(/\D/g,''); const expected=digits.length===10?`+1${digits}`:`+${digits}`;
      if(message?.id!==id || message.direction!=='outbound' || message.to?.length!==1 || message.to[0].phone_number!==expected || message.from?.phone_number!=='+16014198527' || !message.text) throw new Error('evidence_mismatch');
      const status=message.to[0].status;
      if(!['delivered','read','expired','delivery_failed','sending_failed'].includes(status??'')) throw new Error('delivery_evidence_pending');
      return {status:['delivered','read'].includes(status??'')?'sent':'failed',channel,providerId:id,textHash:await digestText(message.text)};
    },
  };
}
