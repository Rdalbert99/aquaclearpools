import { describe, it, expect } from 'vitest';
import { serviceMinutes, timeSource } from './service-duration';
import { chemicalTotals, dailyTotals, serviceDay, csvCell, type Visit } from './technician-report';
const visit = (id: string, extra: Partial<Visit> = {}): Visit => ({ id,service_date:'2026-11-12', status:'completed', technician_id:'a', users:{name:'Tyler'}, ...extra });
describe('visit duration compatibility', () => {
  it('prefers modern duration and preserves zero', () => { expect(serviceMinutes({duration_minutes:0,duration:60})).toBe(0); expect(serviceMinutes({duration_minutes:15,duration:60})).toBe(15); });
  it('supports old records without inventing missing time', () => { expect(serviceMinutes({duration:30})).toBe(30); expect(serviceMinutes({duration_minutes:-1,duration:NaN})).toBeNull(); });
  it('calls a record timed only with valid ordered endpoints and recorded minutes', () => { expect(timeSource({started_at:'2026-11-12T10:00Z',completed_at:'2026-11-12T11:00Z',duration_minutes:60})).toBe('Timed'); expect(timeSource({duration:60})).toBe('Recorded / manual'); expect(timeSource({started_at:'bad',completed_at:'bad',duration_minutes:10})).toBe('Recorded / manual'); expect(timeSource({started_at:'2026-11-12T11:00Z',completed_at:'2026-11-12T10:00Z',duration_minutes:10})).toBe('Recorded / manual'); });
});
describe('technician daily report', () => {
  it('groups timed instants in Central time including DST and preserves manual calendar dates', () => {
    expect(serviceDay(visit('a',{service_date:'2026-11-12T02:00:00Z',started_at:'2026-11-12T01:00:00Z'}))).toBe('2026-11-11');
    expect(serviceDay(visit('a',{service_date:'2026-11-12T00:00:00+00:00'}))).toBe('2026-11-12');
    expect(serviceDay(visit('a',{service_date:'2026-07-12T05:00:00Z',started_at:'2026-07-12T04:00:00Z'}))).toBe('2026-07-12');
  });
  it('does not label inconsistent durations as timed', () => {
    expect(timeSource({started_at:'2026-11-12T10:00Z',completed_at:'2026-11-12T11:00Z',duration_minutes:20})).toBe('Recorded / manual');
    expect(timeSource({started_at:'2026-11-12T10:00Z',completed_at:'2026-11-12T11:00Z',duration:60})).toBe('Recorded / manual');
  });
  it('keeps same-named technicians separate and ignores unfinished visits', () => { const groups=dailyTotals([visit('1',{duration:15}),visit('2',{technician_id:'b',duration_minutes:20}),visit('3',{status:'pending',duration:90})]); expect(groups).toHaveLength(2); expect(groups.map(g=>g.recorded)).toEqual([15,20]); });
  it('separates timed, manually recorded and missing minutes by service date', () => { const [g]=dailyTotals([visit('1',{started_at:'2026-11-12T10:00Z',completed_at:'2026-11-12T10:20Z',duration_minutes:20}),visit('2',{duration:30}),visit('3')]); expect(g).toMatchObject({timed:20,recorded:30,missing:1,visits:3,day:'2026-11-12'}); });
  it('never mixes chemical units or custom labels', () => { const r=(unit:string,quantity_used:number,chemical_label='Acid')=>({service_id:'1',chemical_id:'acid',chemical_label,unit,quantity_used}); expect(chemicalTotals([r('gal',1),r('gal',2),r('qt',1),r('gal',1,'Different'),r('gal',NaN)])).toBe('3 gal Acid; 1 qt Acid; 1 gal Different'); });
  it('quotes CSV values and guards spreadsheet formulas', () => { expect(csvCell('=X')).toBe('"\'=X"'); expect(csvCell('A,"B"')).toBe('"A,""B"""'); });
});
