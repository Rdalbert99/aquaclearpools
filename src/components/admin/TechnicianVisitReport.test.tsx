import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import TechnicianVisitReport from './TechnicianVisitReport';
const db = vi.hoisted(() => ({ range: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
  const q = { select: () => q, eq: () => q, gte: () => q, lt: () => q, order: () => q, in: () => q, range: db.range }; return q;
} } }));
const record = {id:'one',status:'completed',technician_id:'t',users:{name:'Tyler'},clients:{customer:'Test pool'},service_date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),duration_minutes:12};
let renderer: ReactTestRenderer;
const text = () => JSON.stringify(renderer.toJSON());
beforeEach(() => { db.range.mockReset(); });
describe('technician report UI', () => {
  it('renders customer, minutes, manual classification and chemical quantity', async () => {
    db.range.mockResolvedValueOnce({data:[record]}).mockResolvedValueOnce({data:[{service_id:'one',chemical_id:'salt',chemical_label:'Salt',unit:'lbs',quantity_used:40}]});
    await act(async () => { renderer = create(<TechnicianVisitReport />); });
    expect(text()).toContain('Test pool'); expect(text()).toContain('12 min'); expect(text()).toContain('Recorded / manual'); expect(text()).toContain('40 lbs Salt');
    act(() => renderer.unmount());
  });
  it('fails closed if chemical retrieval fails', async () => {
    db.range.mockResolvedValueOnce({data:[record]}).mockResolvedValueOnce({error:{message:'failure'}});
    await act(async () => { renderer = create(<TechnicianVisitReport />); });
    expect(text()).toContain('No partial totals'); expect(text()).not.toContain('Test pool'); act(() => renderer.unmount());
  });
  it('does not show stale rows when an old request finishes after a new date request', async () => {
    let resolveOld: (value: unknown) => void;
    db.range.mockImplementationOnce(() => new Promise(resolve => { resolveOld=resolve; })).mockResolvedValue({data:[]});
    await act(async () => { renderer=create(<TechnicianVisitReport />); });
    await act(async () => { renderer.root.findAllByType('input')[0].props.onChange({target:{value:'2026-01-01'}}); });
    await act(async () => { resolveOld!({data:[record]}); });
    expect(text()).not.toContain('Test pool'); expect(text()).toContain('No completed visits'); act(() => renderer.unmount());
  });
  it('resets technician selection when date range changes', async () => {
    db.range.mockResolvedValueOnce({data:[record]}).mockResolvedValueOnce({data:[]}).mockResolvedValue({data:[]});
    await act(async () => { renderer=create(<TechnicianVisitReport />); });
    act(() => renderer.root.findByType('select').props.onChange({target:{value:'t'}}));
    await act(async () => { renderer.root.findAllByType('input')[0].props.onChange({target:{value:'2026-01-01'}}); });
    expect(renderer.root.findByType('select').props.value).toBe('all'); act(() => renderer.unmount());
  });
});
