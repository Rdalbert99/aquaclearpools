// Helpers to compute chemical usage cost per service call.
// Costs are calculated from `chemical_inventory_purchases` weighted-average
// unit cost per chemical, converted into that chemical's base unit
// (lbs for powders, gal for liquids).

import type { ChemicalEntry, ChemicalUnit } from './chemicals-added';

// Base storage unit for each chemical id in CHEMICAL_OPTIONS.
// Liquids track by gallon, powders by pound.
export const CHEMICAL_BASE_UNIT: Record<string, 'lbs' | 'gal'> = {
  liquid_chlorine: 'gal',
  powder_chlorine: 'lbs',
  trichlor_tabs: 'lbs',
  shock: 'lbs',
  sodium_bicarb: 'lbs',
  sodium_bisulfate: 'lbs',
  muriatic_acid: 'gal',
  soda_ash: 'lbs',
  cya: 'lbs',
  calcium_chloride: 'lbs',
  pool_salt: 'lbs',
  ascorbic_acid: 'lbs',
  algaecide: 'gal',
  clarifier: 'gal',
  phosphate_remover: 'gal',
};

/** Convert a quantity from any entry unit to the chemical's base unit. */
export function toBaseQuantity(amount: number, unit: ChemicalUnit, base: 'lbs' | 'gal'): number {
  if (!isFinite(amount)) return 0;
  if (base === 'lbs') {
    if (unit === 'lbs') return amount;
    if (unit === 'oz') return amount / 16;
    return 0; // liquid unit on a powder chemical
  }
  // base === 'gal'
  if (unit === 'gal') return amount;
  if (unit === 'qt') return amount / 4;
  return 0; // powder unit on a liquid chemical
}

export function baseUnitFor(chemicalId: string): 'lbs' | 'gal' {
  return CHEMICAL_BASE_UNIT[chemicalId] ?? 'lbs';
}

export interface UnitCostMap {
  // chemical_id -> { unitCost, unit }
  [chemicalId: string]: { unitCost: number; unit: 'lbs' | 'gal' };
}

export interface ServiceCostLine {
  chemical_id: string;
  chemical_label: string;
  unit: 'lbs' | 'gal';
  quantity_used: number;
  unit_cost_snapshot: number;
  line_cost: number;
}

/** Build per-line and total cost for a service from its chemical entries. */
export function computeServiceCost(
  entries: ChemicalEntry[],
  catalogLabelFor: (id: string, other?: string) => string,
  unitCosts: UnitCostMap,
): { lines: ServiceCostLine[]; total: number } {
  const lines: ServiceCostLine[] = [];
  for (const e of entries) {
    const amount = parseFloat(e.amount);
    if (!isFinite(amount) || amount <= 0) continue;
    const base = baseUnitFor(e.chemicalId);
    const qty = toBaseQuantity(amount, e.unit, base);
    if (qty <= 0) continue;
    const price = unitCosts[e.chemicalId]?.unitCost ?? 0;
    lines.push({
      chemical_id: e.chemicalId,
      chemical_label: catalogLabelFor(e.chemicalId, e.otherName),
      unit: base,
      quantity_used: qty,
      unit_cost_snapshot: price,
      line_cost: qty * price,
    });
  }
  const total = lines.reduce((s, l) => s + l.line_cost, 0);
  return { lines, total };
}

export function fmtMoney(n: number | null | undefined): string {
  const v = typeof n === 'number' && isFinite(n) ? n : 0;
  return `$${v.toFixed(2)}`;
}
