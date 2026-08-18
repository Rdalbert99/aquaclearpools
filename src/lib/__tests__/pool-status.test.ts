import { describe, it, expect } from 'vitest';
import {
  getBalanceStatus,
  getMissingFixes,
  DEFAULT_TOLERANCES,
  getPoolServiceStatus,
  getNextDueDate,
} from '../pool-status';

const zeroTol = { ph: 0, alkalinity: 0, chlorine: 0, cya: 0, salt: 0 };

describe('getBalanceStatus — ranges', () => {
  it('is balanced when every reading is in range', () => {
    const s = getBalanceStatus({ ph: 7.4, chlorine: 2, alkalinity: 100 }, '', { tolerances: zeroTol });
    expect(s.inBalance).toBe(true);
    expect(s.outOfRange).toHaveLength(0);
    expect(s.inRange).toHaveLength(3);
  });

  it('flags an untreated out-of-range reading', () => {
    const s = getBalanceStatus({ ph: 8.2 }, '', { tolerances: zeroTol });
    expect(s.inBalance).toBe(false);
    expect(s.unresolved).toHaveLength(1);
    expect(s.unresolved[0].direction).toBe('high');
    expect(s.unresolved[0].deviation).toBeCloseTo(0.6);
  });

  it('ignores null/NaN readings', () => {
    const s = getBalanceStatus({ ph: null, chlorine: undefined, cya: NaN }, '');
    expect(s.inBalance).toBe(true);
    expect(s.outOfRange).toHaveLength(0);
    expect(s.inRange).toHaveLength(0);
  });
});

describe('getBalanceStatus — dose matching', () => {
  it('counts muriatic acid as treating high pH', () => {
    const s = getBalanceStatus({ ph: 7.9 }, { label: 'Chemicals added', value: '0.5 gal muriatic acid' }, { tolerances: zeroTol });
    expect(s.inBalance).toBe(true);
    expect(s.outOfRange[0].addressed).toBe(true);
    expect(s.outOfRange[0].matchedSource).toBe('Chemicals added');
    expect(s.outOfRange[0].matchedChemical).toBe('muriatic acid');
    expect(s.outOfRange[0].matchedText).toContain('muriatic');
  });

  it('counts cal-hypo as treating low chlorine', () => {
    const s = getBalanceStatus({ chlorine: 0 }, { label: 'Notes', value: 'added 2 lbs cal hypo' }, { tolerances: zeroTol });
    expect(s.inBalance).toBe(true);
    expect(s.outOfRange[0].matchedSource).toBe('Notes');
  });

  it('finds evidence inside nested action objects', () => {
    const actions = { tasks: [{ name: 'Tested chemicals' }, { name: 'Added sodium bicarbonate' }] };
    const s = getBalanceStatus({ alkalinity: 50 }, { label: 'Actions', value: actions }, { tolerances: zeroTol });
    expect(s.inBalance).toBe(true);
    expect(s.outOfRange[0].matchedChemical).toBe('sodium bicarbonate');
  });

  it('does not count the wrong direction chemical', () => {
    const s = getBalanceStatus({ ph: 6.8 }, { label: 'Chemicals added', value: 'muriatic acid' }, { tolerances: zeroTol });
    expect(s.inBalance).toBe(false);
    expect(s.unresolved[0].missingReason).toMatch(/soda ash/i);
  });

  it('records why a reading is unresolved and which records were searched', () => {
    const s = getBalanceStatus(
      { chlorine: 0 },
      { label: 'Chemicals added', value: 'nothing' },
      { label: 'Notes', value: 'skimmed pool' },
      { tolerances: zeroTol },
    );
    expect(s.inBalance).toBe(false);
    expect(s.searchedSources).toEqual(['Chemicals added', 'Notes']);
    expect(s.unresolved[0].missingReason).toContain('Chemicals added, Notes');
    expect(s.unresolved[0].expectedChemicals).toContain('chlorine');
  });

  it('summarises the verdict', () => {
    const ok = getBalanceStatus({ ph: 7.4 }, '', { tolerances: zeroTol });
    expect(ok.summary).toMatch(/inside their ideal ranges/);
    const bad = getBalanceStatus({ ph: 8.5 }, '', { tolerances: zeroTol });
    expect(bad.summary).toMatch(/still need/);
  });
});

describe('getBalanceStatus — tolerances', () => {
  it('treats a small deviation as balanced with default tolerance', () => {
    const s = getBalanceStatus({ ph: 7.7 }, '', { tolerances: DEFAULT_TOLERANCES });
    expect(s.inBalance).toBe(true);
    expect(s.outOfRange[0].withinTolerance).toBe(true);
    expect(s.outOfRange[0].explanation).toMatch(/tolerance/);
  });

  it('still flags deviations beyond tolerance', () => {
    const s = getBalanceStatus({ ph: 8.0 }, '', { tolerances: { ...DEFAULT_TOLERANCES, ph: 0.2 } });
    expect(s.inBalance).toBe(false);
  });

  it('honours per-chemical overrides', () => {
    const tight = getBalanceStatus({ alkalinity: 75 }, '', { tolerances: { ...zeroTol } });
    const loose = getBalanceStatus({ alkalinity: 75 }, '', { tolerances: { ...zeroTol, alkalinity: 10 } });
    expect(tight.inBalance).toBe(false);
    expect(loose.inBalance).toBe(true);
    expect(loose.outOfRange[0].effectiveMin).toBe(70);
  });
});

describe('getMissingFixes', () => {
  it('returns dosage instructions only for unresolved readings', () => {
    const fixes = getMissingFixes({ ph: 8.4, chlorine: 0 }, 'added chlorine tabs', 15000);
    expect(fixes).toHaveLength(1);
    expect(fixes[0]).toMatch(/pH is high/);
  });

  it('returns nothing when everything is treated', () => {
    expect(getMissingFixes({ ph: 7.4 }, '', 15000)).toEqual([]);
  });
});

describe('schedule helpers', () => {
  it('marks a client current when serviced on the due day', () => {
    const now = new Date('2026-08-19T12:00:00'); // Wednesday
    expect(getPoolServiceStatus(['Monday'], '2026-08-17T10:00:00', null, now)).toBe('current');
    expect(getPoolServiceStatus(['Monday'], '2026-08-10T10:00:00', null, now)).toBe('needs_service');
  });

  it('computes the next due date strictly after today', () => {
    const now = new Date('2026-08-19T12:00:00');
    const next = getNextDueDate(['Monday'], now);
    expect(next?.getDay()).toBe(1);
    expect(next!.getTime()).toBeGreaterThan(now.getTime() - 86400000);
  });
});
