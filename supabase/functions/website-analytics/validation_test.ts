import { assert, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { validEvent, validReport } from './validation.ts';

Deno.test('collector accepts exactly the three events and five categories', () => {
  for (const event of ['page_view','call_click','text_click']) for (const referral of ['direct','search','social','referral','internal']) assert(validEvent({ event,referral,page:'/' }));
});
Deno.test('collector rejects unknown values and identity fields', () => {
  const v = { event:'page_view',referral:'direct',page:'/' };
  for (const x of [null, [], { ...v,event:'login' },{ ...v,referral:'google' },{ ...v,page:'/invoice' },{ ...v,page:'/?secret=x' },{ ...v,referrer:'https://private.test' },{ ...v,visitorId:'123' }]) assertFalse(validEvent(x));
});
Deno.test('report permits only bounded ranges', () => {
  for (const days of [7,30,90]) assert(validReport({ action:'report',days }));
  for (const days of [0,8,365,'30',null]) assertFalse(validReport({ action:'report',days }));
});
Deno.test('report cannot supply an actor or arbitrary query', () => {
  assertFalse(validReport({ action:'report',days:7,actor:'admin' }));
  assertFalse(validReport({ action:'report',days:7,sql:'select *' }));
});