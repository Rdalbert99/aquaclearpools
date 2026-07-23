// Best-effort parser for legacy free-text `services.chemicals_added` notes
// (e.g. "2lbs granulated chlorine", "pH Down (Muriatic Acid): 35 oz",
// "1 lb chlorine.") into structured ChemicalEntry[] we can price.

import type { ChemicalEntry, ChemicalUnit } from './chemicals-added';

interface Rule {
  chemicalId: string;
  // keywords must match the note text (lowercased)
  keywords: RegExp;
  // optional exclude — skip if this pattern matches (used to keep chlorine
  // out of trichlor tabs, etc.)
  exclude?: RegExp;
  defaultUnit: ChemicalUnit;
}

// Order matters — first match wins for a given phrase.
const RULES: Rule[] = [
  { chemicalId: 'trichlor_tabs',   keywords: /trichlor|tri-chlor|3\s*inch\s*tab|tabs?\b/, defaultUnit: 'lbs' },
  { chemicalId: 'shock',           keywords: /\bshock\b/, defaultUnit: 'lbs' },
  { chemicalId: 'muriatic_acid',   keywords: /muriatic|ph\s*down|ph-\s*down|hcl\b|hydrochloric/, defaultUnit: 'gal' },
  { chemicalId: 'sodium_bisulfate',keywords: /sodium\s*bisulfate|dry\s*acid/, defaultUnit: 'lbs' },
  { chemicalId: 'soda_ash',        keywords: /soda\s*ash|ph\s*up|ph-\s*up/, defaultUnit: 'lbs' },
  { chemicalId: 'sodium_bicarb',   keywords: /sodium\s*bicarb|bicarb|baking\s*soda|alkalinity\s*(up|increaser)/, defaultUnit: 'lbs' },
  { chemicalId: 'cya',             keywords: /cyanuric|\bcya\b|stabilizer|conditioner/, defaultUnit: 'lbs' },
  { chemicalId: 'calcium_chloride',keywords: /calcium\s*chloride|calcium\s*hardness|hardness\s*(up|increaser)|\bcalcium\b/, defaultUnit: 'lbs' },
  { chemicalId: 'pool_salt',       keywords: /\bpool\s*salt\b|\bsalt\b/, defaultUnit: 'lbs' },
  { chemicalId: 'ascorbic_acid',   keywords: /ascorbic|metal\s*out|stain\s*(out|remover)/, defaultUnit: 'lbs' },
  { chemicalId: 'algaecide',       keywords: /algaecide|algecide|algae\s*(cide|killer)/, defaultUnit: 'gal' },
  { chemicalId: 'clarifier',       keywords: /clarifier|clarify/, defaultUnit: 'gal' },
  { chemicalId: 'phosphate_remover', keywords: /phosphate/, defaultUnit: 'gal' },
  // Chlorine — decide liquid vs powder based on other cues; excludes trichlor
  // and shock which have their own rules above.
  { chemicalId: 'liquid_chlorine', keywords: /liquid\s*chlorine|\bbleach\b|sodium\s*hypochlorite/, defaultUnit: 'gal' },
  { chemicalId: 'powder_chlorine', keywords: /cal[-\s]?hypo|granular\s*chlorine|granulated\s*chlorine|powder\s*chlorine|\bchlorine\b/, exclude: /liquid|gallon|\bgal\b|bleach/, defaultUnit: 'lbs' },
];

const AMOUNT_UNIT_RE = /(\d+(?:\.\d+)?|\.\d+)\s*(lbs?|pounds?|#|oz|ounces?|gal(?:lons?)?|qt|quarts?)\b/gi;

function normalizeUnit(raw: string): ChemicalUnit | null {
  const u = raw.toLowerCase();
  if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds' || u === '#') return 'lbs';
  if (u === 'oz' || u === 'ounce' || u === 'ounces') return 'oz';
  if (u.startsWith('gal')) return 'gal';
  if (u === 'qt' || u.startsWith('quart')) return 'qt';
  return null;
}

/** Split a note into chunks around common separators so multiple chemicals
 *  in one line can each be extracted independently. */
function splitChunks(text: string): string[] {
  return text
    .split(/\n|(?:\s+and\s+)|;|,|\+|\/(?!\d)/i)
    .map(s => s.trim())
    .filter(Boolean);
}

/** Extract structured entries from a free-text chemicals note.
 *  Returns an empty array if nothing recognizable is found. */
export function parseLegacyChemicalsNote(note: string | null | undefined): ChemicalEntry[] {
  if (!note) return [];
  const chunks = splitChunks(note);
  const results: ChemicalEntry[] = [];
  const seen = new Set<string>(); // dedupe by chemicalId+amount+unit

  for (const chunk of chunks) {
    const lower = chunk.toLowerCase();

    // Find amounts within this chunk
    const amounts: { amount: string; unit: ChemicalUnit; index: number }[] = [];
    AMOUNT_UNIT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = AMOUNT_UNIT_RE.exec(chunk)) != null) {
      const unit = normalizeUnit(m[2]);
      if (!unit) continue;
      amounts.push({ amount: m[1], unit, index: m.index });
    }
    if (!amounts.length) continue;

    // Find which rule matches
    let matched: Rule | undefined;
    for (const rule of RULES) {
      if (!rule.keywords.test(lower)) continue;
      if (rule.exclude && rule.exclude.test(lower)) continue;
      matched = rule;
      break;
    }
    if (!matched) continue;

    for (const a of amounts) {
      // Coerce unit to something compatible with the chemical's base unit
      const wantsGal = matched.defaultUnit === 'gal';
      let unit = a.unit;
      if (wantsGal && (unit === 'lbs' || unit === 'oz')) unit = matched.defaultUnit;
      if (!wantsGal && (unit === 'gal' || unit === 'qt')) unit = matched.defaultUnit;

      const key = `${matched.chemicalId}|${a.amount}|${unit}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ chemicalId: matched.chemicalId, amount: a.amount, unit });
    }
  }

  return results;
}
