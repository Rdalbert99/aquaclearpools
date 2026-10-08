import { describe, expect, it } from 'vitest';
import { checkTraceReading, metalAlerts, phosphateToPpb, ppbToPpm, ppmToPpb, traceTreatment } from '../phosphate-metals';
import { buildIdealChart, latestFromService, profileFromClient, sanitizeOverrides } from '../ideal-chemistry';
import { buildLabRows, labAdvice, labStatus } from '../chemistry-lab';
import { calculatePoolHealth } from '../pool-health';
import { POOL_TESTS, normalizeDefaultTests, TEST_BY_ID } from '../pool-tests';

const plaster = profileFromClient({ pool_type: 'Chlorine', liner_type: 'Plaster' });
const vinyl = profileFromClient({ pool_type: 'Saltwater', liner_type: 'Vinyl' });
const row = (rows: ReturnType<typeof buildIdealChart>, k: string) => rows.find(r => r.key === k);
const label = { productName: 'Brand PR', labelAmount: 16, labelUnit: 'fl oz', labelGallons: 10000 };

describe('phosphate units', () => {
  it('converts 1 ppm = 1000 ppb both ways without float drift', () => {
    expect(ppmToPpb(0.5)).toBe(500);
    expect(ppmToPpb(0.3)).toBe(300);
    expect(ppbToPpm(250)).toBe(0.25);
    expect(phosphateToPpb('0,75', 'ppm')).toBe(750);
    expect(phosphateToPpb(125, 'ppb')).toBe(125);
  });
  it('rejects blank, negative and non-numeric phosphate values', () => {
    expect(phosphateToPpb('', 'ppb')).toBeNull();
    expect(phosphateToPpb(-10, 'ppb')).toBeNull();
    expect(phosphateToPpb('abc', 'ppm')).toBeNull();
  });
  it('flags a likely ppm value typed as ppb and implausible values', () => {
    expect(checkTraceReading('phosphates', 0.5).flag).toMatch(/500 ppb/);
    expect(checkTraceReading('phosphates', -1)).toEqual({ value: null, flag: expect.stringMatching(/Negative/) });
    expect(checkTraceReading('iron', 12).flag).toMatch(/unusually high/);
    expect(checkTraceReading('copper', 0.15)).toEqual({ value: 0.15, flag: null });
  });
});

describe('targets and status', () => {
  it('phosphate default limit is 500 ppb, preserved exactly and max-only', () => {
    const r = row(buildIdealChart(plaster, { phosphates: 125.5 }), 'phosphates')!;
    expect(r.unit).toBe('ppb');
    expect(r.range!.max).toBe(500);
    expect(r.latest).toBe(125.5);
    expect(r.status).toBe('in_range');
    expect(row(buildIdealChart(plaster, { phosphates: 800 }), 'phosphates')!.status).toBe('high');
    expect(row(buildIdealChart(plaster, { phosphates: 0 }), 'phosphates')!.status).toBe('in_range');
  });
  it('per-pool phosphate limit is configurable', () => {
    const p = { ...plaster, overrides: sanitizeOverrides({ phosphates: { max: 300 } }) };
    const r = row(buildIdealChart(p, { phosphates: 400 }), 'phosphates')!;
    expect(r.range!.max).toBe(300);
    expect(r.status).toBe('high');
    expect(r.isCustom).toBe(true);
  });
  it('iron and copper are separate ppm rows with a 0.2 ppm default limit', () => {
    const rows = buildIdealChart(plaster, { iron: 0.3, copper: 0.1 });
    expect(row(rows, 'iron')!.status).toBe('high');
    expect(row(rows, 'copper')!.status).toBe('in_range');
    expect(row(rows, 'iron')!.unit).toBe('ppm');
    expect(row(rows, 'metals')).toBeUndefined();
  });
  it('phosphates never affect sanitizer status or the health score', () => {
    const base = calculatePoolHealth({ readings: { chlorine: 3, ph: 7.4 } }).score;
    const rows = buildIdealChart(plaster, { fc: 3, cya: 40, phosphates: 3000 });
    expect(row(rows, 'fc')!.status).toBe('in_range');
    expect(row(rows, 'phosphates')!.notes.join(' ')).toMatch(/not a sanitizer/);
    expect(TEST_BY_ID.phosphates.chemId).toBeUndefined();
    expect(base).toBe(calculatePoolHealth({ readings: { chlorine: 3, ph: 7.4 } }).score);
  });
  it('reads phosphates/iron/copper back from saved service readings', () => {
    expect(latestFromService({ readings: { phosphates: 450, iron: 0.05, copper: 0.3 } }))
      .toMatchObject({ phosphates: 450, iron: 0.05, copper: 0.3 });
  });
});

describe('alerts', () => {
  it('iron/copper above limit raise staining + surface alerts; under limit none', () => {
    expect(metalAlerts('iron', 0.1, 0.2, 'plaster')).toEqual([]);
    expect(metalAlerts('iron', 0.5, 0.2, 'plaster').join(' ')).toMatch(/brown|rust/);
    expect(metalAlerts('copper', 0.5, 0.2, 'vinyl').join(' ')).toMatch(/liner/);
    expect(metalAlerts('copper', 0.5, 0.2, 'unknown').join(' ')).toMatch(/Surface unknown/);
    expect(metalAlerts('iron', 0.5, 0.2, 'fiberglass').join(' ')).toMatch(/shocking/);
  });
  it('metal rows always carry test-method limitations', () => {
    expect(row(buildIdealChart(vinyl, { copper: 0.1 }), 'copper')!.notes.join(' ')).toMatch(/dissolved metal only/);
  });
});

describe('treatment doses — never invented', () => {
  it('no amount from the reading alone', () => {
    const r = traceTreatment({ product: 'phosphate_remover', reading: 1500, max: 500, gallons: 15000 });
    expect(r.amount).toBeNull();
    expect(r.manual).toBe(true);
    expect(r.message).toMatch(/Manual verification required/);
  });
  it('requires gallons, product name, label dose, context, and covered level', () => {
    const base = { product: 'phosphate_remover' as const, reading: 1000, max: 500 };
    expect(traceTreatment({ ...base, ...label, gallons: null, context: 'initial', labelCoversUpToPpb: 2500 }).amount).toBeNull();
    expect(traceTreatment({ ...base, ...label, productName: '', gallons: 20000, context: 'initial', labelCoversUpToPpb: 2500 }).amount).toBeNull();
    expect(traceTreatment({ ...base, ...label, labelAmount: 0, gallons: 20000, context: 'initial', labelCoversUpToPpb: 2500 }).amount).toBeNull();
    expect(traceTreatment({ ...base, ...label, gallons: 20000, context: null, labelCoversUpToPpb: 2500 }).amount).toBeNull();
    expect(traceTreatment({ ...base, ...label, gallons: 20000, context: 'initial' }).amount).toBeNull();
  });
  it('refuses when the reading exceeds what the label dose covers', () => {
    const r = traceTreatment({ product: 'phosphate_remover', reading: 3000, max: 500, gallons: 20000, ...label, context: 'initial', labelCoversUpToPpb: 2500 });
    expect(r.amount).toBeNull();
    expect(r.message).toMatch(/above the 2500 ppb/);
  });
  it('scales the label dose by gallons only: 16 fl oz/10k gal → 32 fl oz for 20k gal', () => {
    const r = traceTreatment({ product: 'phosphate_remover', reading: 1000, max: 500, gallons: 20000, ...label, context: 'initial', labelCoversUpToPpb: 2500 });
    expect(r.amount).toBe(32);
    expect(r.unit).toBe('fl oz');
  });
  it('sequestrant: label dose by gallons, never promises removal', () => {
    const r = traceTreatment({ product: 'sequestrant', reading: 0.6, max: 0.2, gallons: 15000, productName: 'Brand MS', labelAmount: 32, labelUnit: 'fl oz', labelGallons: 10000, context: 'initial' });
    expect(r.amount).toBe(48);
    expect(r.notes.join(' ')).toMatch(/bind/);
    expect(r.notes.join(' ')).toMatch(/do not remove/);
    expect(`${r.message} ${r.notes.join(' ')}`).not.toMatch(/removes metals/);
  });
  it('negative / invalid readings never produce an amount', () => {
    expect(traceTreatment({ product: 'sequestrant', reading: -0.1, max: 0.2, gallons: 15000, ...label, context: 'initial' }).amount).toBeNull();
    expect(traceTreatment({ product: 'sequestrant', reading: NaN, max: 0.2, gallons: 15000, ...label, context: 'initial' }).amount).toBeNull();
  });
  it('lab advice for high trace rows asks for the product label, never an amount', () => {
    const r = buildLabRows(plaster, { phosphates: 1200 }, ['phosphates'])[0];
    const text = labAdvice(r, plaster, 20000).join(' ');
    expect(text).toMatch(/Manual verification required/);
    expect(text).not.toMatch(/\d+(\.\d+)?\s*(fl oz|oz|lb|qt|gal)\b(?! pools)/);
  });
});

describe('Taylor rack and test selection', () => {
  it('selected trace tests appear as wells even before a reading, untested stays unknown', () => {
    const rows = buildLabRows(plaster, {}, ['fc', 'phosphates', 'iron', 'copper']);
    expect(rows.map(r => r.key)).toEqual(['fc', 'phosphates', 'iron', 'copper']);
    expect(rows.slice(1).every(r => labStatus(r).status === 'unknown')).toBe(true);
  });
  it('no duplicate wells when a key is selected twice', () => {
    expect(buildLabRows(plaster, { iron: 0.1 }, ['iron', 'iron']).length).toBe(1);
  });
  it('historical rack shows recorded trace tests only', () => {
    const keys = buildLabRows(plaster, { fc: 2, cya: 40, copper: 0.3 }).map(r => r.key);
    expect(keys).toContain('copper');
    expect(keys).not.toContain('phosphates');
    expect(keys).not.toContain('iron');
  });
  it('trace tests are optional, unit-correct and not in the required defaults', () => {
    for (const id of ['phosphates', 'iron', 'copper'] as const) {
      expect(TEST_BY_ID[id].optional).toBe(true);
      expect(TEST_BY_ID[id].integer).toBe(false);
    }
    expect(TEST_BY_ID.phosphates.unit).toBe('ppb');
    expect(TEST_BY_ID.iron.unit).toBe('ppm');
    expect(normalizeDefaultTests(null)).not.toContain('phosphates');
    expect(normalizeDefaultTests(['iron', 'iron'])).toEqual(['chlorine', 'alkalinity', 'ph', 'cya', 'iron']);
    expect(new Set(POOL_TESTS.map(t => t.readingKey)).size).toBe(POOL_TESTS.length);
  });
});
