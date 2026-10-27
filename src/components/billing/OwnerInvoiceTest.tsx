/** REVIEW ONLY: mount in the existing signed-in admin invoice page after backend review.
 * Visibility is not authorization: backend independently checks the exact active owner.
 * Never reads, stores or forwards access tokens; billingInvoke uses the normal SDK session.
 */
import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {billingInvoke} from '@/lib/billing-transport';
import {Button} from '@/components/ui/button';
const OWNER_ID='58364ea7-8ca6-45ac-a351-4e4d8d49310e';
type Evidence={status?:string;delivered?:boolean};
type Status={state?:string;observedInvoiceId?:string|null;observedCustomerId?:string|null;invoiceId?:string;payment?:'not_checked'|{balanceCents?:number;paidPaymentIds?:string[]};appAccount?:string;verified?:boolean;paidLabelVerified?:boolean;deliveryEvidence?:{email?:Evidence;sms?:Evidence}};
export function OwnerInvoiceTest(){
 const [owner,setOwner]=useState(false),[busy,setBusy]=useState(false),[checked,setChecked]=useState(false),[attempted,setAttempted]=useState(false);
 const [status,setStatus]=useState<Status|null>(null),[message,setMessage]=useState('');
 const locked=useRef(false),mounted=useRef(false),generation=useRef(0);
 async function currentOwner(){const r=await supabase.auth.getUser();return !r.error&&r.data.user?.id===OWNER_ID;}
 useEffect(()=>{
  mounted.current=true;const stamp=++generation.current;
  const current=()=>mounted.current&&generation.current===stamp;
  void (async()=>{try{
   const isOwner=await currentOwner();if(!current())return;setOwner(isOwner);if(!isOwner)return;
   const value=await billingInvoke<Status>({action:'owner_five_dollar_status'});
   if(current()){setStatus(value);setChecked(true);}
  }catch{if(current())setMessage('Status unavailable. Nothing was sent by this page. Restore sign-in or backend access, then refresh status.');}})();
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
   if(event==='SIGNED_OUT'||(event==='SIGNED_IN'&&session?.user.id!==OWNER_ID)){++generation.current;setOwner(false);setStatus(null);setChecked(false);}
  });
  return()=>{mounted.current=false;++generation.current;subscription.unsubscribe();};
 },[]);
 async function refresh(){
  if(locked.current)return;locked.current=true;setBusy(true);setMessage('');const stamp=generation.current;
  try{if(!await currentOwner()){setOwner(false);return;}
   const value=await billingInvoke<Status>({action:'owner_five_dollar_status'});
   if(mounted.current&&stamp===generation.current){setStatus(value);setChecked(true);}
  }catch{if(mounted.current)setMessage('Status could not be verified. No automatic retry or payment-status change was made.');}
  finally{locked.current=false;if(mounted.current)setBusy(false);}
 }
 async function run(){
  if(locked.current||attempted||!checked)return;locked.current=true;setAttempted(true);setBusy(true);setMessage('');
  const stamp=generation.current;
  try{if(!await currentOwner()){setOwner(false);return;}
   const value=await billingInvoke<Status>({action:'owner_five_dollar_test'});
   if(mounted.current&&stamp===generation.current){setStatus(value);setMessage('Test request returned. Refresh status to verify text/email delivery and payment separately. Do not submit again.');}
  }catch{if(mounted.current)setMessage('The result is uncertain: a record or message may already exist. Do not retry. Use Refresh status and review the recorded outcome.');}
  finally{locked.current=false;if(mounted.current)setBusy(false);}
 }
 if(!owner)return null;
 const payment=typeof status?.payment==='object'?status.payment:null;
 const existing=!!(status?.observedInvoiceId||status?.observedCustomerId||status?.invoiceId||payment||status?.deliveryEvidence?.email?.status&&status.deliveryEvidence.email.status!=='not_started'||status?.deliveryEvidence?.sms?.status&&status.deliveryEvidence.sms.status!=='not_started');
 const delivery=(e?:Evidence)=>e?.delivered===true?'Delivery confirmed':e?.status?`${e.status} - delivery not confirmed`:'Not verified';
 return <section aria-labelledby="owner-invoice-test-title" className="space-y-3 rounded-lg border p-4">
  <h2 id="owner-invoice-test-title" className="text-lg font-semibold">Owner-only $5 invoice test</h2>
  <p className="text-sm">Creates a dedicated, inactive test account and one $5 QuickBooks invoice. Sends its four-option PDF only to rdalbert99@gmail.com and (601) 447-0399. No recurring billing, saved-card charge, or customer batch activation.</p>
  <p className="text-sm">Pay once using the QuickBooks button in the PDF. An accepted message is not confirmed delivery, and delivery is not payment. The PDF is a balance snapshot; its text link expires after seven days.</p>
  <div className="flex flex-wrap gap-2">
   <Button disabled={busy||attempted||existing||!checked} onClick={()=>void run()}>Create and send my one-time $5 test</Button>
   <Button variant="outline" disabled={busy} onClick={()=>void refresh()}>Refresh status - no send</Button>
  </div>
  <div aria-live="polite" className="space-y-1 text-sm">
   {busy&&<p>Checking the owner-only test...</p>}
   {message&&<p role="status">{message}</p>}
   {status&&<><p>Email: {delivery(status.deliveryEvidence?.email)}</p><p>Text: {delivery(status.deliveryEvidence?.sms)}</p>
    <p>QuickBooks balance: {payment&&typeof payment.balanceCents==='number'?`$${(payment.balanceCents/100).toFixed(2)}`:'Not verified'}</p>
    <p>Application account: {status.appAccount??'Not verified'}</p>
    <p>{status.verified===true?'QuickBooks payment and clear application balance verified.':'Payment and application synchronization not yet verified.'}</p>
    {status.paidLabelVerified===false&&<p>A separate application Paid label has not been verified.</p>}</>}
  </div>
 </section>;
}
