import { describe, it, expect } from 'vitest';
import { buildIdealChart, profileFromClient, fcTargetForCya, cyaTargetFor, calciumTargetFor, latestFromService } from '../ideal-chemistry';
import { cyaDose, calciumDose } from '../cya-calcium-dosing';

const row = (rows: ReturnType<typeof buildIdealChart>, k: string) => rows.find(r => r.key === k);

describe('ideal chemistry chart', () => {
  it('salt + plaster pool', () => {
    const p = profileFromClient({ pool_type: 'Salt water', liner_type: 'Plaster' });
    expect(p.sanitizer).toBe('salt');
    expect(p.surface).toBe('plaster');
    const rows = buildIdealChart(p, { cya: 70, salt: 3200, ch: 150 });
    expect(row(rows, 'cya')!.range).toEqual({ min: 60, max: 80, target: 70 });
    expect(row(rows, 'ch')!.range).toEqual({ min: 200, max: 400, target: 250 });
    expect(row(rows, 'ch')!.status).toBe('low');
    expect(row(rows, 'salt')!.status).toBe('in_range');
    expect(row(rows, 'salt')!.basis).toMatch(/General guidance/);
  });

  it('chlorine + vinyl pool has no salt row', () => {
    const p = profileFromClient({ pool_type: 'Chlorine', liner_type: 'Vinyl liner' });
    expect(p.sanitizer).toBe('chlorine');
    expect(p.surface).toBe('vinyl');
    const rows = buildIdealChart(p, { cya: 40 });
    expect(row(rows, 'salt')).toBeUndefined();
    expect(row(rows, 'cya')!.range).toEqual({ min: 30, max: 50, target: 40 });
    expect(row(rows, 'ch')!.range).toEqual({ min: 150, max: 250, target: 175 });
  });

  it('unknown surface is flagged, not guessed', () => {
    const p = profileFromClient({ pool_type: 'In-ground', liner_type: null });
    expect(p.surface).toBe('unknown');
    expect(p.sanitizer).toBe('unknown');
    const ch = row(buildIdealChart(p), 'ch')!;
    expect(ch.notes.join(' ')).toMatch(/Surface unknown/);
  });

  it('missing latest readings → unknown status and FC needs CYA', () => {
    const rows = buildIdealChart(profileFromClient({ pool_type: 'Chlorine', liner_type: 'Plaster' }), {});
    expect(rows.every(r => r.status === 'unknown')).toBe(true);
    expect(row(rows, 'fc')!.range).toBeNull();
    expect(row(rows, 'fc')!.basis).toMatch(/CYA/);
  });

  it('FC scales with CYA (no universal value)', () => {
    expect(fcTargetForCya(40)).toEqual({ min: 3, max: 8, target: 4.6 });
    expect(fcTargetForCya(80)!.min).toBe(6);
    expect(fcTargetForCya(0)!.min).toBe(1);
    const rows = buildIdealChart(profileFromClient({ pool_type: 'Chlorine' }), { cya: 40, fc: 2 });
    expect(row(rows, 'fc')!.status).toBe('low');
  });

  it('custom targets override defaults and are marked', () => {
    const p = profileFromClient({ pool_type: 'Salt', liner_type: 'Plaster',
      chemistry_targets: { ch: { min: 250, max: 450, target: 300 }, salt: { target: 3400, min: 3000, max: 3800 }, salt_source: 'Hayward T-15' } });
    const rows = buildIdealChart(p, { ch: 280 });
    expect(row(rows, 'ch')!.range).toEqual({ min: 250, max: 450, target: 300 });
    expect(row(rows, 'ch')!.isCustom).toBe(true);
    expect(row(rows, 'salt')!.basis).toMatch(/Hayward T-15/);
  });

  it('ignores invalid overrides', () => {
    const p = profileFromClient({ pool_type: 'Chlorine', chemistry_targets: { cya: { min: 60, max: 20 } } });
    expect(cyaTargetFor(p).custom).toBe(false);
  });

  it('optional phosphates only when relevant', () => {
    const p = profileFromClient({ pool_type: 'Chlorine' });
    expect(row(buildIdealChart(p), 'phosphates')).toBeUndefined();
    expect(row(buildIdealChart(p, { phosphates: 800 }), 'phosphates')!.status).toBe('high');
  });

  it('chart and dosing panel use the same targets', () => {
    const p = profileFromClient({ pool_type: 'Salt', liner_type: 'Vinyl', chemistry_targets: { cya: { target: 75 } } });
    const rows = buildIdealChart(p);
    const cyaR = cyaDose({ reading: 50, gallons: 20000, range: cyaTargetFor(p).t });
    expect(cyaR.target).toBe(row(rows, 'cya')!.range!.target);
    const chR = calciumDose({ reading: 100, gallons: 20000, surface: p.surface, product: 'anhydrous', range: calciumTargetFor(p).t });
    expect(chR.range).toEqual(row(rows, 'ch')!.range);
  });

  it('pool volume does not change ppm targets', () => {
    const a = buildIdealChart(profileFromClient({ pool_type: 'Salt', liner_type: 'Plaster' }));
    const b = buildIdealChart(profileFromClient({ pool_type: 'Salt', liner_type: 'Plaster' }));
    expect(a.map(r => r.range)).toEqual(b.map(r => r.range));
  });

  it('reads latest values from service columns', () => {
    expect(latestFromService({ chlorine_level: 3, calcium_hardness_level: 220, readings: { ph: 7.5 } }))
      .toMatchObject({ fc: 3, ch: 220, ph: 7.5 });
  });
});
