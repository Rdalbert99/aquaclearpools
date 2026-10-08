import { describe, it, expect } from 'vitest';
import { getDosageInstruction, parseReadingValue, validPoolGallons } from '../pool-chemistry';
import { cyaDose, calciumDose, CALCIUM_LB_PER_10K_PER_10PPM } from '../cya-calcium-dosing';
import { algaecideDoseOz, getAlgaecideStatus } from '../algaecide';
import { getMissingFixes } from '../pool-status';
import { buildIdealChart, fcTargetForCya, profileFromClient } from '../ideal-chemistry';
import { buildLabRows, labAdvice } from '../chemistry-lab';

// Independent reference: 1 ppm in 10,000 US gal = 0.08345 lb of substance (as CaCO3 for TA/CH).
const LB_PER_PPM_10K = 10000 * 8.345 / 1e6;
const amt = (s: string | null, re: RegExp) => Number((s ?? '').match(re)?.[1]);

describe('stoichiometric reference fixtures', () => {
  it('calcium chloride rates match molar math', () => {
    const pure = 10 * LB_PER_PPM_10K * 110.98 / 100.09;
    expect(CALCIUM_LB_PER_10K_PER_10PPM.anhydrous).toBeCloseTo(pure / 0.94, 1);
    expect(CALCIUM_LB_PER_10K_PER_10PPM.dihydrate).toBeCloseTo(pure / 0.77, 1);
  });
  it('bicarb: 10k gal, TA 70→100 ≈ 4.2 lb', () => {
    const r = getDosageInstruction('alkalinity', 70, 10000, { min: 80, max: 120, target: 100 });
    expect(amt(r, /~([\d.]+) lbs/)).toBeCloseTo(3 * 10 * LB_PER_PPM_10K * 168.02 / 100.09, 1);
    expect(r).toMatch(/not soda ash/);
  });
  it('cal-hypo 65%: 27k gal, FC 1→4 ≈ 1.3 lb', () => {
    const r = getDosageInstruction('chlorine', 1, 27000, { min: 3, max: 7, target: 4 });
    expect(amt(r, /~([\d.]+) lbs/)).toBeCloseTo(3 * LB_PER_PPM_10K * 2.7 / 0.65, 1);
  });
  it('salt: 35k gal, 2400→3200 ≈ 234 lb', () => {
    const r = getDosageInstruction('salt', 2400, 35000, { min: 2700, max: 3400, target: 3200 });
    expect(amt(r, /~(\d+) lbs/)).toBe(Math.ceil(800 * LB_PER_PPM_10K * 3.5));
  });
  it('CYA: 60k gal, 20→40 ≈ 10 lb', () => {
    expect(cyaDose({ reading: 20, gallons: 60000, target: 40 }).lbs!).toBeCloseTo(2 * LB_PER_PPM_10K * 6, 0);
  });
  it('calcium: 12k gal plaster, 150→250 anhydrous', () => {
    expect(calciumDose({ reading: 150, gallons: 12000, surface: 'plaster', product: 'anhydrous', productKnown: true }).lbs).toBe(11.75);
  });
  it('muriatic for TA: 10k gal, 140→100 ≈ 102 fl oz 31.45%', () => {
    const r = getDosageInstruction('alkalinity', 140, 10000, { min: 80, max: 120, target: 100 });
    expect(amt(r, /\((\d+) fl oz/)).toBe(102);
    expect(r).toMatch(/Manual verification required/);
  });
});

describe('pH is never a precise amount', () => {
  it.each([[6.8], [8.2]])('pH %s gives qualitative advice only', (ph) => {
    const r = getDosageInstruction('ph', ph, 20000)!;
    expect(r).toMatch(/Manual verification required/);
    expect(r).not.toMatch(/\d+(\.\d+)? (lbs|gal|oz)/);
  });
});

describe('unknown volume never produces an amount', () => {
  it.each([[null], [undefined], [0], [-5], [NaN], [100]])('gallons=%s', (g) => {
    const r = getDosageInstruction('alkalinity', 50, g as number)!;
    expect(r).toMatch(/volume unknown/);
    expect(validPoolGallons(g)).toBeNull();
    expect(cyaDose({ reading: 10, gallons: g }).lbs).toBeNull();
  });
  it('algaecide no longer assumes 10,000 gal', () => {
    expect(algaecideDoseOz(null)).toBeNull();
    expect(algaecideDoseOz(0)).toBeNull();
    expect(getAlgaecideStatus({ intervalDays: 14 }, null).doseLabel).toMatch(/volume unknown/);
    expect(algaecideDoseOz(35000)).toBe(21);
  });
  it('missing fixes with unknown volume give no number', () => {
    const f = getMissingFixes({ chlorine: 0 }, '', null);
    expect(f[0]).toMatch(/volume unknown/);
  });
});

describe('edge readings', () => {
  it('null/NaN reading → nothing; negative → invalid', () => {
    expect(getDosageInstruction('chlorine', null, 10000)).toBeNull();
    expect(getDosageInstruction('chlorine', NaN, 10000)).toBeNull();
    expect(getDosageInstruction('chlorine', -1, 10000)).toMatch(/invalid/);
  });
  it('high CYA/CH/salt/FC never recommend adding chemical', () => {
    expect(cyaDose({ reading: 120, gallons: 20000 }).lbs).toBeNull();
    expect(calciumDose({ reading: 800, gallons: 20000, surface: 'plaster', product: 'anhydrous', productKnown: true }).lbs).toBeNull();
    expect(getDosageInstruction('salt', 5000, 20000)).toMatch(/drain/);
    expect(getDosageInstruction('chlorine', 15, 20000)).toMatch(/dissipate/);
  });
  it('proportional dosing, no step overshoot (TA 79 → only 21 ppm worth)', () => {
    const r = getDosageInstruction('alkalinity', 79, 10000, { min: 80, max: 120, target: 100 });
    expect(amt(r, /~([\d.]+) lbs/)).toBe(2.9);
  });
  it('dose scales linearly with gallons', () => {
    const a = amt(getDosageInstruction('alkalinity', 60, 10000), /~([\d.]+) lbs/);
    const b = amt(getDosageInstruction('alkalinity', 60, 60000), /~([\d.]+) lbs/);
    expect(b).toBeCloseTo(a * 6, 0);
  });
});

describe('FC vs CYA', () => {
  it('FC minimum 7.5% of CYA, never universal without CYA', () => {
    expect(fcTargetForCya(80)!.min).toBe(6);
    expect(fcTargetForCya(null)).toBeNull();
    const fc = buildIdealChart(profileFromClient({ pool_type: 'Chlorine' }), {}).find(r => r.key === 'fc')!;
    expect(fc.range).toBeNull();
  });
});

describe('cross-screen consistency', () => {
  it('lab advice uses chart ranges and same engine as field dosing', () => {
    const p = profileFromClient({ pool_type: 'Gunite salt' });
    const row = buildLabRows(p, { ch: 150 }, ['ch'])[0];
    const direct = calciumDose({ reading: 150, gallons: 27000, surface: 'plaster', product: 'anhydrous', productKnown: true, range: row.range! });
    expect(labAdvice(row, p, 27000, 'anhydrous', true)[0]).toBe(direct.message);
  });
});

describe('voice decimal precision', () => {
  it.each([['7.6', 7.6], ['7,6', 7.6], ['325', 325], ['0', 0], ['1.25', 1.25]])('%s → %s', (s, n) => {
    expect(parseReadingValue(s)).toBe(n);
  });
  it.each([[''], ['-2'], ['abc'], [null]])('rejects %s', (s) => expect(parseReadingValue(s)).toBeNull());
});
