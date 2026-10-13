import { describe, it, expect } from 'vitest';
import { exactStrength, isPoolVerified, labelError, findDowflake } from '../product-labels';

const base = { product_name: 'DOWFLAKE Xtra', strength_min_pct: 83, strength_max_pct: 87, pool_suitability: 'not_verified' as const, suitability_source: '' };

describe('product labels', () => {
  it('a label range never collapses to one strength', () => {
    expect(exactStrength({ strength_min_pct: 83, strength_max_pct: 87 })).toBeNull();
    expect(exactStrength({ strength_min_pct: 85, strength_max_pct: 85 })).toBe(85);
    expect(exactStrength(null)).toBeNull();
  });
  it('only an active verified label counts as pool-suitable', () => {
    expect(isPoolVerified(null)).toBe(false);
    expect(isPoolVerified({ pool_suitability: 'not_verified', active: true })).toBe(false);
    expect(isPoolVerified({ pool_suitability: 'not_suitable', active: true })).toBe(false);
    expect(isPoolVerified({ pool_suitability: 'verified', active: false })).toBe(false);
    expect(isPoolVerified({ pool_suitability: 'verified', active: true })).toBe(true);
  });
  it('rejects bad strengths and unsourced verification', () => {
    expect(labelError(base)).toBeNull();
    expect(labelError({ ...base, strength_min_pct: 90 })).toMatch(/Minimum/);
    expect(labelError({ ...base, strength_max_pct: 120 })).toMatch(/between/);
    expect(labelError({ ...base, strength_min_pct: -1 })).toMatch(/between/);
    expect(labelError({ ...base, product_name: ' ' })).toMatch(/name/);
    expect(labelError({ ...base, pool_suitability: 'verified' })).toMatch(/confirmed/);
  });
  it('finds the DOWFLAKE record only when active', () => {
    const l: any = { catalog_slug: 'calcium_chloride', product_name: 'DOWFLAKE Xtra', active: true };
    expect(findDowflake([l])).toBe(l);
    expect(findDowflake([{ ...l, active: false }])).toBeNull();
  });
});
