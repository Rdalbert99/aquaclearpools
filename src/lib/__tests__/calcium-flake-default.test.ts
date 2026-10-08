import { describe, expect, it } from 'vitest';
import { calciumDose, DEFAULT_CALCIUM_PRODUCT, PURE_CACL2_LB_PER_10K_PER_10PPM } from '../cya-calcium-dosing';

const base = { reading: 150, gallons: 10000, target: 250, surface: 'plaster' as const };

describe('Aqua Clear calcium chloride flake default', () => {
  it('default product is flake/dihydrate, not anhydrous', () => {
    expect(DEFAULT_CALCIUM_PRODUCT).toBe('dihydrate');
  });
  it('unconfirmed bag uses the dihydrate 77% rate as a labelled estimate with a verify prompt', () => {
    const r = calciumDose({ ...base, product: 'anhydrous' });
    expect(r.lbs).toBe(12);
    expect(r.message).toMatch(/^Estimate \(verify bag strength\)/);
    expect(r.notes[0]).toMatch(/Verify the bag/);
    expect(r.product).toMatch(/flake/);
  });
  it('dihydrate +100 ppm in 10k gal = 12 lb; anhydrous = 9.75 lb (~18% less)', () => {
    const d = calciumDose({ ...base, product: 'dihydrate', productKnown: true }).lbs!;
    const a = calciumDose({ ...base, product: 'anhydrous', productKnown: true }).lbs!;
    expect(d).toBe(12);
    expect(a).toBe(9.75);
    expect(1 - a / d).toBeCloseTo(0.19, 1);
  });
  it('label strength is editable: 80% flake → 0.92529/0.80 × 10 ≈ 11.57 → 11.5 lb (¼ lb steps)', () => {
    const r = calciumDose({ ...base, product: 'dihydrate', productKnown: true, purityPct: 80 });
    expect(r.lbs).toBe(11.5);
    expect(r.product).toMatch(/80%/);
  });
  it('implausible label strength for the product falls back and asks for manual verification', () => {
    const r = calciumDose({ ...base, product: 'dihydrate', productKnown: true, purityPct: 95 });
    expect(r.lbs).toBe(12);
    expect(r.notes[0]).toMatch(/Manual verification required/);
  });
});
