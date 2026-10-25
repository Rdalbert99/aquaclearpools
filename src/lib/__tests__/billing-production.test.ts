import { describe,it,expect,vi } from 'vitest';
import { readinessRow,OWNER_IDS,batchDates,type Snapshot } from '../billing-readiness';
import { billingProviders,verifiedInvoice,validatedPaymentLink } from '../../../docs/billing-readiness/server/providers';
import { sourceAuthority } from '../../../docs/billing-readiness/server/source';
import { saveNewClientEnrollment } from '../billing-enrollment';
import { bootstrapReview } from '../../../docs/billing-readiness/server/bootstrap';
import { createBillingApplication } from '../../../docs/billing-readiness/server/production';
function snapshot():Snapshot {
 const scope={businessId:'b1',environment:'sandbox' as const,realmId:'123'};
 const s=readinessRow({id:'c1',customer:'Synthetic',status:'Active',service_rate:200,contact_phone:'6015550100',contact_email:'synthetic@example.test'},'2026-10',{
 ...scope,enrollment:{enabled:true,firstServicePeriod:'2026-11',revision:1,updatedBy:'owner',updatedAt:'2026-10-25T12:00:00Z'},
 mapping:{...scope,clientId:'c1',customerId:'114',verified:true,revision:'1'},provider:{itemId:'1',incomeAccountId:'2',taxCode:'NON',taxMode:'non_taxable',verified:true,revision:'1'},smsConsent:true,smsOptedOut:false,consentRevision:'1'}).snapshot;
 if(!s)throw new Error('fixture');return s;
}
function raw(s:Snapshot){return {Id:'901',CustomerRef:{value:'114'},TotalAmt:200,Balance:200,DueDate:s.dueDate,TxnDate:'2026-10-26',PrivateNote:`Aqua Clear service ${s.serviceStart} through ${s.serviceEnd}; monthly; billing-run:abc`,InvoiceLink:'https://connect.intuit.com/pay/test',Line:[{Description:`Pool service ${s.serviceStart} through ${s.serviceEnd}`,SalesItemLineDetail:{ItemRef:{value:'1'}}}]};}
describe('concrete production source package (offline)',()=>{
 it('frozen cohort is exactly 33 with Laken, Peggy and no runtime newcomers',()=>{expect(bootstrapReview.members).toHaveLength(33);expect(new Set(bootstrapReview.members).size).toBe(33);expect(bootstrapReview.members).toContain(OWNER_IDS.laken);expect(bootstrapReview.members).toContain(OWNER_IDS.peggy);expect(bootstrapReview.members).not.toContain('future-new-client');});
 it('new client saves enrollment using actual ID and failure never returns success',async()=>{const invoke=vi.fn(async(_body:Record<string,unknown>)=>({enrollment:{enabled:false,firstServicePeriod:null,revision:1,updatedBy:'owner',updatedAt:'now'}}));await saveNewClientEnrollment(invoke,'actual-created-id',{enabled:false,firstServicePeriod:null,revision:0,updatedBy:'',updatedAt:''});expect(invoke.mock.calls[0][0]).toMatchObject({clientId:'actual-created-id',enabled:false});await expect(saveNewClientEnrollment(async()=>({error:'unauthorized'}),'real-id',{enabled:false,firstServicePeriod:null,revision:0,updatedBy:'',updatedAt:''})).rejects.toThrow('unauthorized');});
 it('concrete source returns no fabricated source on read failure',async()=>{await expect(sourceAuthority({rpc:async()=>({data:null,error:{message:'missing'}})},{businessId:'b',environment:'sandbox',realmId:'123'}).source('c')).rejects.toThrow('source_unavailable');});
 it('provider proof validates real fields and run marker',()=>{const s=snapshot();expect(verifiedInvoice(raw(s),s,'abc').id).toBe('901');expect(()=>verifiedInvoice({...raw(s),PrivateNote:'manual pool service'},s,'abc')).toThrow('provider_result_mismatch');expect(()=>verifiedInvoice({...raw(s),CustomerRef:{value:'999'}},s)).toThrow();});
 it('payment URL cannot be guessed or foreign',()=>{expect(validatedPaymentLink('https://evil.test/invoice/901')).toBeNull();expect(validatedPaymentLink('https://connect.intuit.com/pay/test')).toContain('intuit.com');});
 it('paid manual invoices block automatic duplicate creation',async()=>{const s=snapshot();const fetch=vi.fn(async()=>new Response(JSON.stringify({QueryResponse:{Invoice:[{...raw(s),Balance:0}]}})));const p=billingProviders({businessId:'b1',environment:'sandbox',realmId:'123',fetch,authorization:async()=>'synthetic',secret:()=>undefined,db:{rpc:async()=>({data:null,error:null})}});expect((await p.provider.existing(s)).status).toBe('ambiguous');});
 it('uncertain provider submission is not retried',async()=>{const s=snapshot();let sends=0;const fetch=vi.fn(async(url:string)=>{if(url.includes('telnyx')){sends++;throw new Error('timeout');}return new Response(JSON.stringify(url.includes('/query')?{QueryResponse:{Invoice:[raw(s)]}}:{Invoice:raw(s)}));});const p=billingProviders({businessId:'b1',environment:'sandbox',realmId:'123',fetch,authorization:async()=>'synthetic',secret:()=> 'synthetic',db:{rpc:async()=>({data:null,error:null})}});expect(await p.provider.deliver(s,'901','sms','b1:sandbox:123:c1:2026-11:monthly:sms')).toBe('unknown');expect(sends).toBe(1);});
 it('due/send rollover retains exact owner dates',()=>{expect(batchDates('2026-10')).toMatchObject({sendAt:'2026-10-26T17:00:00.000Z',dueDate:'2026-11-01'});expect(batchDates('2026-11')).toMatchObject({sendAt:'2026-11-30T18:00:00.000Z',dueDate:'2026-12-01'});expect(batchDates('2026-12').servicePeriod).toBe('2027-01');});
 it('runnable factory denies invalid JWT before any privileged query or provider call',async()=>{
  const fetch=vi.fn(async()=>new Response(JSON.stringify({message:'invalid jwt'}),{status:401,headers:{'Content-Type':'application/json'}}));
  const app=createBillingApplication({secret:n=>n==='SUPABASE_URL'?'https://synthetic.invalid':'synthetic-test-key',fetch,scope:{businessId:'b1',environment:'sandbox',realmId:'123'},allowedOrigins:['https://app.example.test']});
  const response=await app.handler(new Request('https://app.example.test',{method:'POST',headers:{Authorization:'Bearer invalid-test','Content-Type':'application/json'},body:JSON.stringify({action:'readiness'})}));
  expect(response.status).toBe(401);expect(fetch).toHaveBeenCalledTimes(1);expect(String(fetch.mock.calls[0]?.[0])).toContain('/auth/v1/user');
 });
});
