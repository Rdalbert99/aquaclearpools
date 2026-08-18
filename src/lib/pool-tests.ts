// Water test definitions, per-pool defaults and Taylor test-kit field guides.

import type { ChemicalId } from './pool-chemistry';

export type TestId = 'chlorine' | 'alkalinity' | 'ph' | 'cya' | 'calcium' | 'salt';

export interface TestDef {
  id: TestId;
  /** Full name shown in settings and reports. */
  label: string;
  /** Short label used on the compact field form. */
  short: string;
  unit: string;
  step: string;
  /** Key used in the service `readings` JSON. */
  readingKey: string;
  /** Matching chemistry range id, when we track ideal ranges for it. */
  chemId?: ChemicalId;
  /** Optional tests can be toggled on/off per visit. */
  optional: boolean;
  integer: boolean;
  /** Taylor kit reagents used. */
  reagents: string;
  steps: string[];
  tips: string[];
}

export const DEFAULT_TEST_IDS: TestId[] = ['chlorine', 'alkalinity', 'ph', 'cya'];

export const POOL_TESTS: TestDef[] = [
  {
    id: 'chlorine',
    label: 'Free Chlorine',
    short: 'FC',
    unit: 'ppm',
    step: '0.1',
    readingKey: 'fc',
    chemId: 'chlorine',
    optional: false,
    integer: false,
    reagents: 'Taylor R-0870 DPD powder + R-0871 titrating reagent (FAS-DPD)',
    steps: [
      'Rinse the 10 mL sample tube with pool water, then fill to the 10 mL line from elbow depth away from returns.',
      'Add one dip (0.5 g scoop) of R-0870 DPD powder and swirl until dissolved — the sample turns pink if chlorine is present.',
      'Add R-0871 one drop at a time, swirling after each drop, and count the drops.',
      'Stop the moment the pink color disappears completely and the sample is clear.',
      'Multiply the drop count by 0.5 to get free chlorine in ppm (using a 10 mL sample).',
    ],
    tips: [
      'A 25 mL sample gives 0.2 ppm per drop — use it when you need finer resolution on low chlorine.',
      'If the sample flashes pink then instantly clears, chlorine is very high — dilute the sample 50/50 with tap water and double the result.',
      'Keep reagent bottles out of the sun and replace R-0871 yearly; old reagent reads low.',
    ],
  },
  {
    id: 'alkalinity',
    label: 'Total Alkalinity',
    short: 'TA',
    unit: 'ppm',
    step: '1',
    readingKey: 'ta',
    chemId: 'alkalinity',
    optional: false,
    integer: true,
    reagents: 'Taylor R-0007 (thiosulfate), R-0008 (indicator), R-0009 (titrant)',
    steps: [
      'Fill the sample tube to the 25 mL line.',
      'Add 2 drops of R-0007 and swirl (this neutralizes chlorine so it will not bleach the indicator).',
      'Add 5 drops of R-0008 — the sample turns green.',
      'Add R-0009 one drop at a time, swirling after each drop, until the green turns red.',
      'Multiply the drop count by 10 to get total alkalinity in ppm.',
    ],
    tips: [
      'Hold the bottle vertical so drops are a consistent size.',
      'Test alkalinity before pH adjustments — TA drives pH stability.',
      'Skipping R-0007 on a heavily chlorinated pool will bleach the color and give a false low reading.',
    ],
  },
  {
    id: 'ph',
    label: 'pH',
    short: 'pH',
    unit: '',
    step: '0.1',
    readingKey: 'ph',
    chemId: 'ph',
    optional: false,
    integer: false,
    reagents: 'Taylor R-0004 phenol red',
    steps: [
      'Fill the pH side of the comparator block to the fill line with fresh pool water.',
      'Add 5 drops of R-0004 phenol red and cap/swirl to mix.',
      'Hold the comparator up against a white background in open shade — never in direct sun.',
      'Match the sample color to the closest standard and read the pH (target 7.4–7.6).',
    ],
    tips: [
      'If chlorine is above ~10 ppm the sample can turn purple — add a drop of R-0007 first or retest later.',
      'Do not read pH through sunglasses or against a colored surface.',
      'Rinse the block between tests so reagents do not cross-contaminate.',
    ],
  },
  {
    id: 'cya',
    label: 'Cyanuric Acid (CYA)',
    short: 'CYA',
    unit: 'ppm',
    step: '1',
    readingKey: 'cya',
    chemId: 'cya',
    optional: false,
    integer: true,
    reagents: 'Taylor R-0013 turbidity reagent + view tube',
    steps: [
      'Fill the mixing bottle to the 7 mL line with pool water, then add R-0013 to the 14 mL line.',
      'Cap and shake for about 30 seconds — the sample turns cloudy. Let it stand 30 seconds.',
      'Shake again, then slowly pour the cloudy sample into the view tube while looking down at the black dot in the bottom.',
      'Stop pouring the instant the black dot disappears.',
      'Read the number at the liquid level on the tube — that is CYA in ppm (target 30–50).',
    ],
    tips: [
      'Do the test outdoors in daylight, at waist height, looking straight down.',
      'Cold water reads low — let the sample come near air temperature.',
      'If the dot is still visible with the tube full, CYA is under 30 ppm.',
    ],
  },
  {
    id: 'calcium',
    label: 'Calcium Hardness',
    short: 'CH',
    unit: 'ppm',
    step: '10',
    readingKey: 'ch',
    optional: true,
    integer: true,
    reagents: 'Taylor R-0010 buffer, R-0011L indicator, R-0012 titrant',
    steps: [
      'Fill the sample tube to the 25 mL line.',
      'Add 20 drops of R-0010 hardness buffer and swirl.',
      'Add 5 drops of R-0011L indicator — the sample turns red if hardness is present.',
      'Add R-0012 one drop at a time, swirling after each drop, until the color changes to a clear blue with no red or purple tint.',
      'Multiply the drop count by 10 to get calcium hardness in ppm (target 200–400).',
    ],
    tips: [
      'The end point creeps — go slow near the change and give each drop a few seconds.',
      'A purple hold-out means metals in the water; add a couple extra buffer drops.',
      'Vinyl-liner pools tolerate lower hardness; plaster pools need 200+ to avoid etching.',
    ],
  },
  {
    id: 'salt',
    label: 'Salt',
    short: 'Salt',
    unit: 'ppm',
    step: '100',
    readingKey: 'salt',
    chemId: 'salt',
    optional: true,
    integer: true,
    reagents: 'Taylor K-1766 salt test — R-0718 indicator + R-0630 silver nitrate titrant',
    steps: [
      'Rinse and fill the sample tube to the 10 mL line.',
      'Add 5 drops of R-0718 salt indicator and swirl — the sample turns yellow.',
      'Add R-0630 silver nitrate one drop at a time, swirling after each drop, and count the drops.',
      'Stop when the color changes from yellow to a brick/rust red that holds.',
      'Multiply the drop count by 200 to get salt in ppm (target 2,700–3,400 unless the generator says otherwise).',
    ],
    tips: [
      'Run the pump for a while before sampling so salt is evenly mixed.',
      'Silver nitrate stains skin, clothing and decks — rinse spills immediately.',
      'Trust the titration over the generator display; cell readouts drift as the cell ages.',
    ],
  },
];

export const TEST_BY_ID: Record<TestId, TestDef> = POOL_TESTS.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {} as Record<TestId, TestDef>);

export function isTestId(v: unknown): v is TestId {
  return typeof v === 'string' && POOL_TESTS.some(t => t.id === v);
}

/** Normalize a stored default_tests value, always keeping the four required tests. */
export function normalizeDefaultTests(value: unknown, poolType?: string | null): TestId[] {
  const stored = Array.isArray(value) ? value.filter(isTestId) : [];
  const set = new Set<TestId>([...DEFAULT_TEST_IDS, ...stored]);
  if (stored.length === 0 && poolType && /salt/i.test(poolType)) set.add('salt');
  return POOL_TESTS.filter(t => set.has(t.id)).map(t => t.id);
}

/** Order a list of test ids the same way the form displays them. */
export function sortTests(ids: TestId[]): TestId[] {
  return POOL_TESTS.filter(t => ids.includes(t.id)).map(t => t.id);
}
