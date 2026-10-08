import { describe, expect, it } from 'vitest';
import { buildLabRows, labAdvice, labStatus, scalePosition } from '../chemistry-lab';
import { buildIdealChart, profileFromClient } from '../ideal-chemistry';

const salt = profileFromClient({ pool_type: 'Saltwater', liner_type: 'Plaster' });
const vinyl = profileFromClient({ pool_type: 'Chlorine', liner_type: 'Vinyl' });

describe('Chemistry Lab controlled readings and rules', () => {
  it('preserves pH 7.6 exactly and marks the boundary near limit', () => {
    const row = buildLabRows(salt, { ph: 7.6 }, ['ph'])[0];
    expect(row.latest).toBe(7.6);
    expect(labStatus(row)).toEqual({ status: 'near-limit', label: 'Near limit' });
  });
  it('preserves calcium hardness 325 without snapping to a test step', () => {
    const row = buildLabRows(salt, { ch: 325 }, ['ch'])[0];
    expect(row.latest).toBe(325);
    expect(labStatus(row).status).toBe('in-range');
  });
  it('shows low and high as out of range, not a higher-is-healthier score', () => {
    const low = buildLabRows(salt, { ph: 6.9 }, ['ph'])[0];
    const high = buildLabRows(salt, { ph: 8.1 }, ['ph'])[0];
    expect(labStatus(low)).toEqual({ status: 'out-of-range', label: 'Low' });
    expect(labStatus(high)).toEqual({ status: 'out-of-range', label: 'High' });
    expect(scalePosition('ph', 8.1)).toBeGreaterThan(scalePosition('ph', 6.9));
  });
  it('keeps empty untested values unknown rather than zero', () => {
    expect(buildLabRows(salt, {}).every(row => row.latest === null && labStatus(row).status === 'unknown')).toBe(true);
  });
  it('keeps measured zero distinct from an untested reading', () => {
    const row = buildLabRows(vinyl, { fc: 0, cya: 40 }, ['fc'])[0];
    expect(row.latest).toBe(0);
    expect(labStatus(row).label).toBe('Low');
  });
  it('does not mark ideal zero combined chlorine near a lower limit', () => {
    expect(labStatus(buildLabRows(salt, { cc: 0 }, ['cc'])[0]).status).toBe('in-range');
  });
  it('shows only selected tests, no duplicate wells, and salt only for salt pools', () => {
    expect(buildLabRows(salt, {}, ['fc', 'ph', 'ta', 'fc']).map(r => r.key)).toEqual(['fc', 'ph', 'ta']);
    expect(buildLabRows(vinyl, {}, ['salt', 'ph']).map(r => r.key)).toEqual(['ph']);
    expect(buildLabRows(salt, {}, ['fc', 'ph', 'ta', 'cya', 'ch', 'cc', 'salt'])).toHaveLength(7);
  });
  it('lab and chart use identical pool overrides and CYA-dependent chlorine', () => {
    const profile = profileFromClient({ pool_type: 'Salt', liner_type: 'Plaster', chemistry_targets: { ch: { min: 250, target: 300, max: 450 } } });
    const readings = { ch: 325, cya: 70, fc: 4 };
    const lab = buildLabRows(profile, readings);
    const chart = buildIdealChart(profile, readings);
    for (const row of lab) expect(row.range).toEqual(chart.find(r => r.key === row.key)?.range);
    expect(lab.find(r => r.key === 'ch')?.range?.target).toBe(300);
    expect(lab.find(r => r.key === 'fc')?.status).toBe('low');
  });
  it('uses separate chemistry scales, clamping visuals not saved values', () => {
    expect(scalePosition('ch', 325)).toBe(32.5);
    expect(scalePosition('salt', 3000)).toBe(50);
    expect(scalePosition('ch', 1200)).toBe(100);
    expect(buildLabRows(salt, { ch: 1200 }, ['ch'])[0].latest).toBe(1200);
  });
  it('keeps gallons required for numeric dose advice and never mutates readings', () => {
    const readings = { cya: 20 };
    const row = buildLabRows(vinyl, readings, ['cya'])[0];
    expect(labAdvice(row, vinyl, null)[0]).toContain('Enter the pool volume');
    expect(labAdvice(row, vinyl, 12000)[0]).toContain('2 lb');
    expect(readings).toEqual({ cya: 20 });
  });
  it('respects surface and selected calcium product', () => {
    const row = buildLabRows(salt, { ch: 150 }, ['ch'])[0];
    expect(labAdvice(row, salt, 10000, 'anhydrous', true)[0]).toContain('12.5 lb');
    expect(labAdvice(row, salt, 10000, 'dihydrate', true)[0]).toContain('16.75 lb');
    const vinylRow = buildLabRows(vinyl, { ch: 160 }, ['ch'])[0];
    expect(labAdvice(vinylRow, vinyl, 10000)[0]).toContain('No calcium needed');
  });
  it('missing CYA never gives a universal FC dose', () => {
    const row = buildLabRows(vinyl, { fc: 2 }, ['fc'])[0];
    expect(labStatus(row).label).toBe('Target unknown');
    expect(labAdvice(row, vinyl, 10000)[0]).toContain('confirmed target');
  });
});