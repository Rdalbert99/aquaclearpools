import { describe, it, expect } from 'vitest';
import { calciumDose, calciumProductFromLabel, PURE_CACL2_LB_PER_10K_PER_10PPM } from '@/lib/cya-calcium-dosing';

// Independent stoichiometry: 1 ppm CH (as CaCO3) in 10k gal = 0.08345 lb CaCO3; CaCl2/CaCO3 = 110.98/100.09.
const pureLb = (ppm: number, gal: number) => ppm * 0.08345 * (gal / 10000) * (110.98 / 100.09);
const base = { surface: 'plaster' as const, product: 'dowflake_xtra' as const, productKnown: true, range: { min: 200, max: 400, target: 250 } };

describe('DOWFLAKE Xtra 83–87%', () => {
  it('pure CaCl2 constant matches stoichiometry', () => {
    expect(PURE_CACL2_LB_PER_10K_PER_10PPM).toBeCloseTo(pureLb(10, 10000), 6);
  });
  it('hides amount until pool suitability is verified', () => {
    const r = calciumDose({ ...base, reading: 150, gallons: 10000 });
    expect(r.lbs).toBeNull();
    expect(r.message).toMatch(/Manual verification required/);
  });
  it('gives a conservative range 87%→83% for 10k gal +100 ppm', () => {
    const r = calciumDose({ ...base, reading: 150, gallons: 10000, suitabilityVerified: true });
    expect(r.lbs).toBe(Math.floor(pureLb(100, 10000) / 0.87 * 4) / 4); // 10.5
    expect(r.lbs).toBe(10.5);
    expect(r.lbsMax).toBe(11.25); // 11.15 rounded up
    expect(r.lbs! * 0.87).toBeLessThanOrEqual(pureLb(100, 10000));
  });
  it('27k gal +100 ppm range', () => {
    const r = calciumDose({ ...base, reading: 150, gallons: 27000, suitabilityVerified: true });
    expect(r.lbs).toBe(28.5); expect(r.lbsMax).toBe(30.25);
  });
  it('exact lot % inside range gives single amount', () => {
    const r = calciumDose({ ...base, reading: 150, gallons: 10000, suitabilityVerified: true, purityPct: 85 });
    expect(r.lbsMax).toBeNull(); expect(r.lbs).toBe(11);
  });
  it('% outside 83–87 falls back to range with manual verification', () => {
    const r = calciumDose({ ...base, reading: 150, gallons: 10000, suitabilityVerified: true, purityPct: 77 });
    expect(r.lbsMax).toBe(11.25); expect(r.notes[0]).toMatch(/Manual verification required/);
  });
  it('less product than generic 77% dihydrate', () => {
    const d = calciumDose({ ...base, product: 'dihydrate', reading: 150, gallons: 10000 });
    const x = calciumDose({ ...base, reading: 150, gallons: 10000, suitabilityVerified: true });
    expect(x.lbsMax!).toBeLessThan(d.lbs!);
  });
  it('unknown gallons, high CH, no reading never give amounts', () => {
    expect(calciumDose({ ...base, reading: 150, gallons: null, suitabilityVerified: true }).lbs).toBeNull();
    expect(calciumDose({ ...base, reading: 500, gallons: 10000, suitabilityVerified: true }).lbs).toBeNull();
    expect(calciumDose({ ...base, reading: null, gallons: 10000, suitabilityVerified: true }).lbs).toBeNull();
  });
  it('label detection', () => {
    expect(calciumProductFromLabel('DOWFLAKE Xtra')).toBe('dowflake_xtra');
    expect(calciumProductFromLabel('Calcium chloride 83-87%')).toBe('dowflake_xtra');
    expect(calciumProductFromLabel('flake 77%')).toBe('dihydrate');
  });
});
