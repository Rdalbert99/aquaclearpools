import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { discoverProvider, readCustomer, compareIdentity, customerFingerprint, searchCustomers } from '../../../docs/billing-readiness/server/setup';
import { createBillingApplication } from '../../../docs/billing-readiness/server/production';
import { batchSummary, enrollmentLabel, announcementAudience, type BatchRow } from '../billing-batch';
import { readinessRow, OWNER_IDS } from '../billing-readiness';
import { routeGate } from '../route-gate';
const mock = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/lib/billing-transport', () => ({ billingInvoke: mock.invoke }));
vi.mock('@/components/ui/checkbox', () => ({ Checkbox: ({ onCheckedChange, checked, ...p }: { onCheckedChange?: (v: boolean) => void; checked?: boolean } & Record<string, unknown>) => <input type="checkbox" {...p} checked={!!checked} onClick={() => onCheckedChange?.(!checked)} readOnly /> }));
import { ProviderSetup, CustomerMapping } from '@/components/billing/BillingSetup';


const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });
const byLabel = (t: ReactTestRenderer, l: string) => t.root.findAll(n => typeof n.type === 'string' && n.props['aria-label'] === l)[0];
const button = (t: ReactTestRenderer, text: string) => t.root.find(n => typeof n.type === 'string' && n.type === 'button' && [n.props.children].flat().join('').includes(text));
const provider = { realmId:'9341452568721903',companyName:'Aqua Clear Pools',country:'US',taxSupported:true,blockers:[],fingerprint:'fp1',item:{id:'1010000001',name:'Pool Maintenance',active:true,type:'Service',taxable:false,incomeAccountId:'79'},account:{id:'79',name:'Services',active:true,type:'Income'}};
const discovery = {scope:{realmId:'9341452568721903',environment:'production'},app:{id:'c1',customer:'Customer One',status:'Active'},customer:{id:'58',displayName:'Customer One',active:true,email:'one@example.test',phone:'',address:''},fingerprint:'cf1',comparison:{supported:true,blockers:[],evidence:[{field:'email',result:'match'}]}};
describe('independent regression checks',()=>{
 beforeEach(()=>mock.invoke.mockReset());
 it('changing provider item during pending read allows a fresh read after old response',async()=>{
  let resolve!:(v:unknown)=>void;mock.invoke.mockImplementation((b?:unknown)=>b?new Promise(r=>{resolve=r;}):Promise.resolve({}));
  let t!:ReactTestRenderer;await act(async()=>{t=create(<ProviderSetup/>);});
  await act(async()=>{button(t,'Look up').props.onClick();});
  await act(async()=>byLabel(t,'QuickBooks item ID').props.onChange({target:{value:'22'}}));
  await act(async()=>{resolve({provider});});await flush();
  expect(button(t,'Look up').props.disabled).toBe(false);
 });
 it('changing selected appcustomer during pending lookup allows fresh lookup',async()=>{
  let resolve!:(v:unknown)=>void;mock.invoke.mockImplementation((b?:unknown)=>b?new Promise(r=>{resolve=r;}):Promise.resolve({}));
  let t!:ReactTestRenderer;await act(async()=>{t=create(<CustomerMapping clients={[{id:'c1',customer:'Customer One'},{id:'c2',customer:'Customer Two'}]}/>);});
  await act(async()=>byLabel(t,'App customer').props.onChange({target:{value:'c1'}}));
  await act(async()=>byLabel(t,'QuickBooks customer ID').props.onChange({target:{value:'58'}}));
  await act(async()=>{button(t,'Look up').props.onClick();});
  await act(async()=>byLabel(t,'App customer').props.onChange({target:{value:'c2'}}));
  await act(async()=>{resolve(discovery);});await flush();
  expect(button(t,'Look up').props.disabled).toBe(false);
 });
 it('editing QBcustomerID while read pending never repopulates old identity',async()=>{
  let resolve!:(v:unknown)=>void;mock.invoke.mockImplementation((b?:unknown)=>b?new Promise(r=>{resolve=r;}):Promise.resolve({}));
  let t!:ReactTestRenderer;await act(async()=>{t=create(<CustomerMapping clients={[{id:'c1',customer:'Customer One'}]}/>);});
  await act(async()=>byLabel(t,'App customer').props.onChange({target:{value:'c1'}}));
  await act(async()=>byLabel(t,'QuickBooks customer ID').props.onChange({target:{value:'58'}}));
  await act(async()=>{button(t,'Look up').props.onClick();});
  await act(async()=>byLabel(t,'QuickBooks customer ID').props.onChange({target:{value:'59'}}));
  await act(async()=>{resolve(discovery);});await flush();
  expect(t.root.findAll(n=>n.props['data-testid']==='identity-evidence')).toHaveLength(0);
 });
});

describe('independent identity safety checks',()=>{
 const app={id:'c1',customer:'Customer One',status:'Active',contact_email:null,contact_phone:null,address:'123 Main Street Unit 1, Purvis MS 39475'};
 const qb={id:'58',displayName:'Customer One',active:true,email:'',phone:'',address:'123 Main Street Unit 2, Purvis MS 39475',syncToken:'0'};
 it('same first three address tokens with different unit never match',()=>{expect(compareIdentity(app,qb).supported).toBe(false);expect(compareIdentity(app,qb).evidence.find(e=>e.field==='address')?.result).toBe('conflict');});
 it('same first three address tokens with different city never match',()=>{expect(compareIdentity({...app,address:'123 Main Street, Purvis MS 39475'},{...qb,address:'123 Main Street, Hattiesburg MS 39401'}).supported).toBe(false);});
 it('matching short phone strings cannot establish identity',()=>{expect(compareIdentity({...app,address:null,contact_phone:'555'},{...qb,address:'',phone:'555'}).supported).toBe(false);});
 it('missing Active does not count as active customer',async()=>{const c=await readCustomer(async()=>({Customer:{Id:'58',DisplayName:'Customer One'}}),'58');expect(c.active).toBe(false);});
 it('missing Active blocks item/account provider discovery',async()=>{const get=async(path:string)=>path.startsWith('/item/')?{Item:{Id:'1010000001',Name:'Pool Maintenance',IncomeAccountRef:{value:'79'},Type:'Service'}}:path.startsWith('/account/')?{Account:{Id:'79',AccountType:'Income'}}:{CompanyInfo:{Id:'9341452568721903',Country:'US'}}; const result=await discoverProvider(get,'9341452568721903','1010000001');expect(result.taxSupported).toBe(false);expect(result.blockers).toContain('Item inactive');expect(result.blockers).toContain('Income account inactive');});
});

describe('explicit save success and cancel evidence',()=>{
 beforeEach(()=>mock.invoke.mockReset());
 it('provider verified:false cannot display saved',async()=>{
  const saved=vi.fn();mock.invoke.mockImplementation(async(b?:{action:string})=>b?.action==='discover_provider'?{provider}:{verified:false});
  let t!:ReactTestRenderer;await act(async()=>{t=create(<ProviderSetup onSaved={saved}/>);});
  await act(async()=>{button(t,'Look up').props.onClick();});await flush();
  await act(async()=>byLabel(t,'Confirm non-taxable').props.onClick());
  await act(async()=>{button(t,'Verify & save').props.onClick();});await flush();
  expect(saved).not.toHaveBeenCalled();expect(t.root.find(n=>n.props.role==='status').props.children).toContain('not saved');
 });
 it('mapping verified:false cannot display saved',async()=>{
  const saved=vi.fn();mock.invoke.mockImplementation(async(b?:{action:string})=>b?.action==='discover_customer'?discovery:{verified:false});
  let t!:ReactTestRenderer;await act(async()=>{t=create(<CustomerMapping clients={[{id:'c1',customer:'Customer One'}]} onSaved={saved}/>);});
  await act(async()=>byLabel(t,'App customer').props.onChange({target:{value:'c1'}}));await act(async()=>byLabel(t,'QuickBooks customer ID').props.onChange({target:{value:'58'}}));
  await act(async()=>{button(t,'Look up').props.onClick();});await flush();await act(async()=>byLabel(t,'Confirm identity match').props.onClick());
  await act(async()=>{button(t,'Save verified link').props.onClick();});await flush();
  expect(saved).not.toHaveBeenCalled();expect(t.root.find(n=>n.props.role==='status').props.children).toContain('not saved');
 });
 it('actual provider Cancel clears busy and ignores late save result without claiming rollback',async()=>{
  const saved=vi.fn();let resolve!:(v:unknown)=>void;
  mock.invoke.mockImplementation((b?:{action:string})=>!b?Promise.resolve({}):b.action==='discover_provider'?Promise.resolve({provider}):new Promise(r=>{resolve=r;}));
  let t!:ReactTestRenderer;await act(async()=>{t=create(<ProviderSetup onSaved={saved}/>);});
  await act(async()=>{button(t,'Look up').props.onClick();});await flush();await act(async()=>byLabel(t,'Confirm non-taxable').props.onClick());
  await act(async()=>{button(t,'Verify & save').props.onClick();});
  await act(async()=>{button(t,'Cancel').props.onClick();});
  expect(button(t,'Look up').props.disabled).toBe(false);
  await act(async()=>{resolve({verified:true});});await flush();
  expect(saved).not.toHaveBeenCalled();expect(t.root.findAll(n=>n.props.role==='status')).toHaveLength(0);
  expect(mock.invoke.mock.calls.filter(c=>c[0]?.action==='verify_provider')).toHaveLength(1);
 });
});
