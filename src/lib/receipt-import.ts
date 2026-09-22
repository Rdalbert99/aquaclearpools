// Helpers for the receipt / invoice importer in the Inventory area.
// Everything here is pure so the review screen can recompute as the user edits.

import { CHEMICAL_BASE_UNIT } from './inventory-cost';

export interface ParsedLineItem {
  quantity: number | null;
  sku: string | null;
  description: string | null;
  unit_price: number | null;
  line_total: number | null;
  package_size: number | null;
  package_unit: string | null;
}

export interface ParsedReceipt {
  vendor: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  line_items: ParsedLineItem[];
}

export interface CatalogItem {
  id: string;            // slug used as chemical_id everywhere else
  label: string;
  sku?: string | null;
  baseUnit: 'lbs' | 'gal';
}

/** Editable row on the review screen. */
export interface ReviewLine {
  key: string;
  quantity: string;        // containers purchased
  sku: string;
  description: string;
  unitPrice: string;       // price per container
  lineTotal: string;
  packageSize: string;     // e.g. 100
  packageUnit: '' | 'lbs' | 'gal' | 'oz' | 'qt';
  matchedId: string | null;  // existing catalog slug, or null
  matchSource: 'sku' | 'name' | 'none';
  createNew: boolean;
  newLabel: string;
  newBaseUnit: 'lbs' | 'gal';
  include: boolean;
}

const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'pool', 'lb', 'lbs', 'gal', 'gallon', 'case', 'pail', 'bucket', 'jug']);

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9%\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !STOPWORDS.has(w))
    .join(' ')
    .trim();
}

function tokens(value: string): string[] {
  return normalizeName(value).split(' ').filter(Boolean);
}

/** Score 0..1 of how well an invoice description matches a catalog label. */
export function nameScore(description: string, label: string): number {
  const a = tokens(description);
  const b = tokens(label);
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  let hits = 0;
  for (const t of b) if (setA.has(t)) hits++;
  return hits / b.length;
}

export function matchLine(
  line: { sku: string; description: string },
  catalog: CatalogItem[],
): { id: string | null; source: 'sku' | 'name' | 'none' } {
  const sku = line.sku.trim().toLowerCase();
  if (sku) {
    const bySku = catalog.find(c => (c.sku ?? '').trim().toLowerCase() === sku);
    if (bySku) return { id: bySku.id, source: 'sku' };
  }
  const desc = line.description ?? '';
  if (desc.trim()) {
    let best: { id: string; score: number } | null = null;
    for (const c of catalog) {
      const score = nameScore(desc, c.label);
      if (!best || score > best.score) best = { id: c.id, score };
    }
    if (best && best.score >= 0.5) return { id: best.id, source: 'name' };
  }
  return { id: null, source: 'none' };
}

export function baseUnitForCatalogId(id: string, catalog: CatalogItem[]): 'lbs' | 'gal' {
  return catalog.find(c => c.id === id)?.baseUnit ?? CHEMICAL_BASE_UNIT[id] ?? 'lbs';
}

/** Convert a package size into the chemical's base unit (lbs or gal). */
export function packageToBase(size: number, unit: string, base: 'lbs' | 'gal'): number {
  if (!isFinite(size) || size <= 0) return 0;
  if (base === 'lbs') {
    if (unit === 'lbs') return size;
    if (unit === 'oz') return size / 16;
    return 0;
  }
  if (unit === 'gal') return size;
  if (unit === 'qt') return size / 4;
  return 0;
}

/**
 * Stock added by a line, in the chemical's base unit.
 * A single 100 lb bucket adds 100 lbs — the package size is metadata, not a count.
 */
export function baseQuantityFor(line: ReviewLine, base: 'lbs' | 'gal'): number {
  const qty = parseFloat(line.quantity);
  if (!isFinite(qty) || qty <= 0) return 0;
  const size = parseFloat(line.packageSize);
  const perPackage = line.packageUnit ? packageToBase(size, line.packageUnit, base) : 0;
  return perPackage > 0 ? qty * perPackage : qty;
}

export function lineCostFor(line: ReviewLine): number {
  const total = parseFloat(line.lineTotal);
  if (isFinite(total) && total > 0) return total;
  const qty = parseFloat(line.quantity);
  const price = parseFloat(line.unitPrice);
  if (isFinite(qty) && isFinite(price)) return qty * price;
  return 0;
}

export function slugify(label: string): string {
  return normalizeName(label).replace(/\s+/g, '_').slice(0, 48) || `item_${Date.now()}`;
}

function num(v: number | null | undefined): string {
  return v === null || v === undefined || !isFinite(v) ? '' : String(v);
}

/** Detect "100#", "100 lb", "4 gal" inside a description when the model missed it. */
export function sniffPackage(description: string): { size: number | null; unit: ReviewLine['packageUnit'] } {
  const d = description.toLowerCase();
  const m = d.match(/(\d+(?:\.\d+)?)\s*(#|lbs?\b|pounds?\b|gals?\b|gallons?\b|oz\b|qts?\b)/);
  if (!m) return { size: null, unit: '' };
  const size = parseFloat(m[1]);
  const raw = m[2];
  let unit: ReviewLine['packageUnit'] = '';
  if (raw === '#' || raw.startsWith('lb') || raw.startsWith('pound')) unit = 'lbs';
  else if (raw.startsWith('gal')) unit = 'gal';
  else if (raw.startsWith('oz')) unit = 'oz';
  else if (raw.startsWith('qt')) unit = 'qt';
  return { size, unit };
}

export function toReviewLines(parsed: ParsedReceipt, catalog: CatalogItem[]): ReviewLine[] {
  return (parsed.line_items ?? []).map((li, i) => {
    const description = li.description ?? '';
    const sniffed = sniffPackage(description);
    const packageUnit = (li.package_unit as ReviewLine['packageUnit']) || sniffed.unit || '';
    const packageSize = li.package_size ?? (packageUnit ? sniffed.size : null);
    const match = matchLine({ sku: li.sku ?? '', description }, catalog);
    const baseUnit: 'lbs' | 'gal' =
      packageUnit === 'gal' || packageUnit === 'qt' ? 'gal' : 'lbs';
    return {
      key: `line-${i}`,
      quantity: num(li.quantity) || '1',
      sku: li.sku ?? '',
      description,
      unitPrice: num(li.unit_price),
      lineTotal: num(li.line_total),
      packageSize: num(packageSize),
      packageUnit,
      matchedId: match.id,
      matchSource: match.source,
      createNew: false,
      newLabel: description.trim().slice(0, 60),
      newBaseUnit: match.id ? baseUnitForCatalogId(match.id, catalog) : baseUnit,
      include: true,
    };
  });
}
