import { serviceMinutes, timeSource, type DurationRecord } from './service-duration';
export interface Visit extends DurationRecord {
  id: string; service_date: string; status: string; technician_id: string | null;
  users?: { name: string | null } | null; clients?: { customer: string | null } | null;
  chemicals_added?: string | null;
}
export interface Usage { service_id: string; chemical_id: string; chemical_label: string; unit: string; quantity_used: number }
export function serviceDay(s: Visit) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s.service_date)) return s.service_date;
  // Legacy manual form submitted a calendar date as UTC midnight, not an instant.
  if (!s.started_at && /T00:00:00(?:\.0+)?(?:Z|\+00:00)$/.test(s.service_date)) return s.service_date.slice(0, 10);
  const date = new Date(s.service_date);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date) : '';
}
export function chemicalTotals(rows: Usage[]) {
  const totals = new Map<string, { label: string; unit: string; quantity: number }>();
  rows.forEach(r => {
    if (!Number.isFinite(Number(r.quantity_used)) || Number(r.quantity_used) < 0) return;
    // Never add pounds to gallons, or merge differently named custom products.
    const key = JSON.stringify([r.chemical_id, r.chemical_label, r.unit]);
    const item = totals.get(key) ?? { label: r.chemical_label, unit: r.unit, quantity: 0 };
    item.quantity += Number(r.quantity_used); totals.set(key, item);
  });
  return [...totals.values()].sort((a,b) => a.label.localeCompare(b.label)).map(r => `${Number(r.quantity.toFixed(2))} ${r.unit} ${r.label}`).join('; ');
}
export function dailyTotals(visits: Visit[]) {
  const groups = new Map<string, { day: string; technicianId: string | null; name: string; visits: number; timed: number; recorded: number; missing: number; ids: string[] }>();
  for (const s of visits.filter(s => s.status === 'completed')) {
    const day = serviceDay(s), key = JSON.stringify([day, s.technician_id]);
    const group = groups.get(key) ?? { day, technicianId: s.technician_id, name: s.users?.name || 'Unassigned', visits: 0, timed: 0, recorded: 0, missing: 0, ids: [] };
    group.visits++; group.ids.push(s.id);
    const minutes = serviceMinutes(s);
    if (minutes === null) group.missing++;
    else if (timeSource(s) === 'Timed') group.timed += minutes;
    else group.recorded += minutes;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a,b) => b.day.localeCompare(a.day) || a.name.localeCompare(b.name));
}
export function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g,'""')}"`;
}
