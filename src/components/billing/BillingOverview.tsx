import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { billingInvoke } from '@/lib/billing-transport';
import { initialSendMonth } from '@/lib/billing-readiness';

export interface OverviewInvoice {
  id:string; number:string; issuedDate:string; dueDate:string|null; amountCents:number; balanceCents:number;
  payment:'paid'|'part_paid'|'unpaid'|'settled_unverified'|'zero_invoice'|'unavailable';
  paidDate:string|null;lastPaymentDate:string|null;recordedPaymentCents:number|null;
  received:'unconfirmed';qboEmailSent:boolean;
}
export interface OverviewRow {clientId:string;customer:string;status:'ok'|'unavailable';reason?:string;invoices?:OverviewInvoice[];totalDueCents?:number|null}
interface Result {issuedMonth:string;rows:OverviewRow[];nextOffset:number|null;asOf:string}
type Invoice=OverviewInvoice; type Row=OverviewRow;
const usd=(value:number)=>(value/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
const paymentLabel=(i:Invoice)=>i.payment==='paid'?'Paid':i.payment==='part_paid'?'Part paid':i.payment==='unpaid'?'Unpaid':i.payment==='zero_invoice'?'Zero / void — not a payment':i.payment==='settled_unverified'?'Balance settled / adjusted — payment unverified':'Payment unavailable';
export function overviewValues(row:Row){
  const invoices=row.invoices??[];
  if(row.status!=='ok')return {invoiced:'Unavailable',date:'',received:'—',amount:'—',due:'Unavailable',paid:'Unavailable',paidDate:''};
  const dates=[...new Set(invoices.map(i=>i.issuedDate))].sort();
  const paidDates=[...new Set(invoices.filter(i=>i.payment==='paid').map(i=>i.paidDate).filter(Boolean))].sort();
  return {
    invoiced:invoices.length===0?'Not in this month':invoices.length===1?'Yes':'Yes · '+invoices.length+' invoices',
    date:dates.length===1?dates[0]:dates.length?dates[0]+' – '+dates[dates.length-1]:'',
    received:invoices.length?'Not confirmed':'—',
    amount:invoices.length?usd(invoices.reduce((sum,i)=>sum+i.amountCents,0)):'—',
    due:row.totalDueCents==null?'Unavailable':usd(row.totalDueCents),
    paid:!invoices.length?'—':invoices.every(i=>i.payment==='paid')?'Paid':invoices.length===1?paymentLabel(invoices[0]):'See invoice details',
    paidDate:invoices.length>0&&invoices.every(i=>i.payment==='paid')?(paidDates.length===1?paidDates[0]:paidDates.length?paidDates[0]+' – '+paidDates[paidDates.length-1]:'Date unavailable'):'',
  };
}
function InvoiceDetails({row}:{row:Row}){
  return <details className="mt-2 text-xs"><summary className="cursor-pointer text-muted-foreground hover:text-foreground">Invoice details</summary>
    {row.reason&&<p className="mt-2">{row.reason}</p>}
    {(row.invoices??[]).map(i=><div key={i.id} className="mt-2 space-y-1 border-t pt-2">
      <p className="font-medium">Invoice #{i.number} · {usd(i.amountCents)}</p>
      <p>Issued {i.issuedDate}{i.dueDate?' · Due '+i.dueDate:''} · Remaining {usd(i.balanceCents)}</p>
      <p>{paymentLabel(i)}{i.paidDate?' · Paid '+i.paidDate:i.lastPaymentDate?' · Last recorded payment '+i.lastPaymentDate:''}</p>
      <p>{i.qboEmailSent?'QuickBooks reports emailed; receipt not confirmed.':'Receipt not confirmed.'}</p>
      <p className="break-all text-muted-foreground">QuickBooks invoice ID {i.id}</p>
    </div>)}
    {!row.invoices?.length&&row.status==='ok'&&<p className="mt-2">No invoices dated in this month. Total due can include older invoices.</p>}
  </details>;
}
export function BillingOverview(){
  const [month,setMonth]=useState(initialSendMonth);
  const [rows,setRows]=useState<Row[]>([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [asOf,setAsOf]=useState('');
  const [refresh,setRefresh]=useState(0);
  const sequence=useRef(0);
  useEffect(()=>{
    const request=++sequence.current;
    const current=()=>sequence.current===request;
    setRows([]);setError('');setAsOf('');setLoading(true);
    void (async()=>{
      try{
        let offset:number|null=0;const all=new Map<string,Row>();
        const seen=new Set<number>();
        while(offset!==null){
          if(seen.has(offset)||seen.size>=100)throw Error('Invoice list is incomplete. Please refresh.');
          seen.add(offset);
          const result:Result=await billingInvoke<Result>({action:'invoice_overview',issuedMonth:month,offset});
          if(!current())return;
          if(result.issuedMonth!==month||!Array.isArray(result.rows))throw Error('Invoice month could not be verified.');
          result.rows.forEach(row=>all.set(row.clientId,row));
          setRows([...all.values()].sort((a,b)=>a.customer.localeCompare(b.customer)));
          setAsOf(result.asOf);offset=result.nextOffset;
        }
      }catch{if(current())setError('Some invoice information could not be loaded. Nothing unavailable is counted as zero. Please refresh.');}
      finally{if(current())setLoading(false);}
    })();
    return()=>{sequence.current++;};
  },[month,refresh]);
  return <section className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Customer invoices</h1><p className="text-sm text-muted-foreground">Actual QuickBooks invoices — no proposed charges included.</p></div>
      <div className="flex flex-wrap items-end gap-2"><label className="space-y-1 text-sm">Invoices issued in<Input aria-label="Invoice issue month" type="month" value={month} onChange={e=>setMonth(e.target.value)} className="w-44"/></label><Button variant="outline" disabled={loading} onClick={()=>setRefresh(n=>n+1)}>Refresh</Button></div>
    </div>
    <p className="text-xs text-muted-foreground">Total due includes all outstanding invoices for each customer. Received means confirmed delivery, not opened; payment dates come from recorded payments.</p>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {loading&&<p role="status" className="text-sm text-muted-foreground">Loading customer invoices… {rows.length?rows.length+' customers loaded.':''}</p>}
    {!loading&&!rows.length&&!error&&<p>No active customers in the reviewed billing roster.</p>}
    {rows.length>0&&<div className="hidden overflow-x-auto rounded-xl border bg-card md:block"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-muted/40 text-muted-foreground">{['Customer','Invoiced / date','Received','Invoice amount','Total due','Paid / date'].map(label=><th key={label} className="p-3 font-medium">{label}</th>)}</tr></thead>
      <tbody>{rows.map(row=>{const v=overviewValues(row);return <tr key={row.clientId} className="border-b align-top last:border-0">
        <td className="max-w-[16rem] break-words p-3"><Link className="font-medium text-primary hover:underline" to={'/admin/clients/'+row.clientId}>{row.customer}</Link><InvoiceDetails row={row}/></td>
        <td className="p-3">{v.invoiced}<div className="text-xs text-muted-foreground">{v.date}</div></td>
        <td className="p-3 text-muted-foreground">{v.received}</td><td className="p-3 tabular-nums">{v.amount}</td>
        <td className="p-3 font-semibold tabular-nums">{v.due}</td><td className="p-3">{v.paid}<div className="text-xs text-muted-foreground">{v.paidDate}</div></td>
      </tr>;})}</tbody></table></div>}
    <div className="space-y-3 md:hidden">{rows.map(row=>{const v=overviewValues(row);return <article key={row.clientId} className="rounded-xl border bg-card p-4">
      <div className="flex justify-between gap-3"><Link className="min-w-0 break-words font-semibold text-primary" to={'/admin/clients/'+row.clientId}>{row.customer}</Link><div className="shrink-0 text-right"><div className="text-xs text-muted-foreground">Total due</div><div className="font-semibold tabular-nums">{v.due}</div></div></div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">Invoiced</dt><dd>{v.invoiced}<div className="text-xs">{v.date}</div></dd></div>
        <div><dt className="text-xs text-muted-foreground">Invoice amount</dt><dd className="tabular-nums">{v.amount}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Received</dt><dd>{v.received}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Paid</dt><dd className="break-words">{v.paid}<div className="text-xs">{v.paidDate}</div></dd></div>
      </dl><InvoiceDetails row={row}/></article>;})}</div>
    {asOf&&<p className="text-xs text-muted-foreground">Last read {new Date(asOf).toLocaleString()}{loading?' · Still loading':error?' · Incomplete':''}</p>}
  </section>;
}
