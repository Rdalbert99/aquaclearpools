import { describe, it, expect } from 'vitest';
import { cyaDose, calciumDose, detectSurface, calciumProductFromLabel } from '../cya-calcium-dosing';

describe('cyaDose', () => {
  it('low: ~1 lb per 12,000 gal per 10 ppm', () => {
    const r = cyaDose({ reading: 30, gallons: 12000, target: 40 });
    expect(r.status).toBe('low');
    expect(r.delta).toBe(10);
    expect(r.lbs).toBe(1);
    expect(r.oz).toBe(16);
  });
  it('on target recommends nothing', () => {
    expect(cyaDose({ reading: 40, gallons: 15000 }).lbs).toBeNull();
    expect(cyaDose({ reading: 45, gallons: 15000 }).status).toBe('ok');
  });
  it('high warns water management, no chemical', () => {
    const r = cyaDose({ reading: 90, gallons: 15000 });
    expect(r.status).toBe('high');
    expect(r.lbs).toBeNull();
    expect(r.message).toMatch(/drain/);
  });
  it('missing gallons gives no number', () => {
    const r = cyaDose({ reading: 10, gallons: null });
    expect(r.status).toBe('needs_volume');
    expect(r.lbs).toBeNull();
    expect(cyaDose({ reading: 10, gallons: 0 }).status).toBe('needs_volume');
  });
});

describe('calciumDose', () => {
  it('anhydrous vs dihydrate rates', () => {
    const a = calciumDose({ reading: 150, gallons: 10000, target: 250, surface: 'plaster', product: 'anhydrous', productKnown: true });
    const d = calciumDose({ reading: 150, gallons: 10000, target: 250, surface: 'plaster', product: 'dihydrate', productKnown: true });
    expect(a.lbs).toBe(12.5);
    expect(d.lbs).toBe(16.75);
  });
  it('unknown product labelled estimate', () => {
    const r = calciumDose({ reading: 150, gallons: 10000, surface: 'plaster', product: 'dihydrate' });
    expect(r.message).toMatch(/^Estimate/);
  });
  it('vinyl at 160 ppm is not raised; plaster at 160 is', () => {
    expect(calciumDose({ reading: 160, gallons: 10000, surface: 'vinyl', product: 'anhydrous' }).status).toBe('ok');
    expect(calciumDose({ reading: 160, gallons: 10000, surface: 'plaster', product: 'anhydrous' }).status).toBe('low');
  });
  it('high calcium: no dose', () => {
    expect(calciumDose({ reading: 500, gallons: 10000, surface: 'plaster', product: 'anhydrous' }).lbs).toBeNull();
  });
  it('missing gallons requires volume', () => {
    expect(calciumDose({ reading: 100, gallons: undefined, surface: 'plaster', product: 'anhydrous' }).status).toBe('needs_volume');
  });
  it('detects surface and product strength', () => {
    expect(detectSurface('Vinyl', 'Chlorine')).toBe('vinyl');
    expect(detectSurface(null, 'Gunite salt')).toBe('plaster');
    expect(detectSurface(null, 'Chlorine')).toBe('unknown');
    expect(calciumProductFromLabel('Calcium Chloride 94% Anhydrous')).toBe('anhydrous');
    expect(calciumProductFromLabel('Calcium Chloride')).toBeNull();
  });
});
