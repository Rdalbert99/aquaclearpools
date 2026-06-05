// Catalog of chemicals a technician can add, with default units and a
// plain-English explanation of what each chemical does. Used by the
// ChemicalsAddedInput component, the customer SMS builder, and any
// place we need to display added chemicals consistently.

export type ChemicalUnit = 'lbs' | 'oz' | 'gal' | 'qt';

export interface ChemicalOption {
  id: string;
  label: string;
  units: ChemicalUnit[]; // first entry is the default
  purpose: string;       // short explanation for the customer
}

export const CHEMICAL_OPTIONS: ChemicalOption[] = [
  { id: 'liquid_chlorine',  label: 'Liquid Chlorine',           units: ['gal', 'qt'], purpose: 'to sanitize the water and raise chlorine' },
  { id: 'powder_chlorine',  label: 'Powder Chlorine (Cal-Hypo)', units: ['lbs', 'oz'], purpose: 'to sanitize the water and raise chlorine' },
  { id: 'trichlor_tabs',    label: 'Trichlor Tabs',              units: ['lbs', 'oz'], purpose: 'for slow-release chlorination' },
  { id: 'shock',            label: 'Pool Shock',                 units: ['lbs', 'oz'], purpose: 'to shock the pool and break down contaminants' },
  { id: 'sodium_bicarb',    label: 'Sodium Bicarbonate',         units: ['lbs', 'oz'], purpose: 'to raise total alkalinity' },
  { id: 'sodium_bisulfate', label: 'Sodium Bisulfate (Dry Acid)', units: ['lbs', 'oz'], purpose: 'to lower pH and total alkalinity' },
  { id: 'muriatic_acid',    label: 'Muriatic Acid',              units: ['gal', 'qt'], purpose: 'to lower pH and total alkalinity' },
  { id: 'soda_ash',         label: 'Soda Ash',                   units: ['lbs', 'oz'], purpose: 'to raise pH' },
  { id: 'cya',              label: 'Cyanuric Acid (CYA / Stabilizer)', units: ['lbs', 'oz'], purpose: 'to stabilize chlorine from sun loss' },
  { id: 'calcium_chloride', label: 'Calcium Chloride',           units: ['lbs', 'oz'], purpose: 'to raise calcium hardness' },
  { id: 'pool_salt',        label: 'Pool Salt',                  units: ['lbs'],       purpose: 'to raise salt for the chlorine generator' },
  { id: 'ascorbic_acid',    label: 'Ascorbic Acid',              units: ['lbs', 'oz'], purpose: 'to remove metal stains from pool surfaces' },
  { id: 'algaecide',        label: 'Algaecide',                  units: ['oz', 'qt'],  purpose: 'to prevent and treat algae' },
  { id: 'clarifier',        label: 'Clarifier',                  units: ['oz', 'qt'],  purpose: 'to clear cloudy water' },
  { id: 'phosphate_remover',label: 'Phosphate Remover',          units: ['oz', 'qt'],  purpose: 'to remove phosphates that feed algae' },
  { id: 'other',            label: 'Other',                      units: ['lbs', 'oz', 'gal', 'qt'], purpose: '' },
];

export interface ChemicalEntry {
  chemicalId: string;
  amount: string;     // keep as string so empty input is allowed in form
  unit: ChemicalUnit;
  otherName?: string; // used when chemicalId === 'other'
}

export function newChemicalEntry(): ChemicalEntry {
  return { chemicalId: 'liquid_chlorine', amount: '', unit: 'gal' };
}

export function getChemicalOption(id: string): ChemicalOption | undefined {
  return CHEMICAL_OPTIONS.find(c => c.id === id);
}

/** Display name for an entry (resolves "other" to its custom name). */
export function entryDisplayName(entry: ChemicalEntry): string {
  if (entry.chemicalId === 'other') return entry.otherName?.trim() || 'Other chemical';
  return getChemicalOption(entry.chemicalId)?.label ?? entry.chemicalId;
}

/** "2 lbs Sodium Bicarbonate" */
export function formatEntry(entry: ChemicalEntry): string {
  const name = entryDisplayName(entry);
  const amt = entry.amount?.trim();
  if (!amt) return name;
  return `${amt} ${entry.unit} ${name}`;
}

/** Multi-line string for storage in services.chemicals_added. */
export function entriesToString(entries: ChemicalEntry[]): string {
  return entries
    .filter(e => e.amount.trim() || e.chemicalId !== 'liquid_chlorine' || e.otherName?.trim())
    .filter(e => e.amount.trim()) // only keep entries with an amount
    .map(formatEntry)
    .join('\n');
}

/** Sentence describing what each added chemical is for, for the customer SMS. */
export function entriesToCustomerExplanation(entries: ChemicalEntry[]): string {
  const valid = entries.filter(e => e.amount.trim());
  if (!valid.length) return '';
  const lines = valid.map(e => {
    const opt = getChemicalOption(e.chemicalId);
    const purpose = opt?.purpose || (e.chemicalId === 'other' ? '' : '');
    const base = `${formatEntry(e)}`;
    return purpose ? `${base} — ${purpose}` : base;
  });
  return `Chemicals added:\n• ${lines.join('\n• ')}`;
}

/** Parse a stored multi-line string back into entries (best-effort) for editing. */
export function parseStoredString(value: string | null | undefined): ChemicalEntry[] {
  if (!value?.trim()) return [];
  return value.split(/\r?\n|,(?![^()]*\))/).map(line => {
    const text = line.trim();
    if (!text) return null;
    // try "<amount> <unit> <name>"
    const m = text.match(/^([\d.]+)\s*(lbs|oz|gal|qt)\s+(.+)$/i);
    if (m) {
      const name = m[3].trim();
      const match = CHEMICAL_OPTIONS.find(c => c.label.toLowerCase() === name.toLowerCase());
      return {
        chemicalId: match?.id ?? 'other',
        amount: m[1],
        unit: m[2].toLowerCase() as ChemicalUnit,
        otherName: match ? undefined : name,
      } as ChemicalEntry;
    }
    return { chemicalId: 'other', amount: '', unit: 'lbs', otherName: text } as ChemicalEntry;
  }).filter(Boolean) as ChemicalEntry[];
}
