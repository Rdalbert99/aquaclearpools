## Goal

Show what you've spent on past customer service calls by applying your inventory unit costs to services that were logged before the cost tracking system existed.

## Current state

- 484 total services in the database.
- 260 have chemical notes but `chemicals_cost = 0` and no structured `service_chemical_usage` rows — they were logged as free text like "2lbs granulated chlorine", "1 lb chlorine.", "pH Down (Muriatic Acid): 35 oz", "Added chlorine and metal out".
- 6 chemicals have purchase history I can price against: powder chlorine, trichlor tabs, calcium chloride, pool salt, algaecide, clarifier. Muriatic acid, sodium bicarb, soda ash, CYA and others have no purchase records yet, so they have no unit cost.

## What the plan will do

### 1. Text parser for old service notes

Add a helper that scans each old `chemicals_added` string for:

- an amount + unit (`2 lbs`, `35 oz`, `.5 gal`, `1 gallon`, `8oz`)
- a chemical keyword (chlorine / cal-hypo / shock / trichlor / tabs / muriatic / acid / bicarb / soda ash / CYA / stabilizer / calcium / salt / algaecide / clarifier / phosphate)

Rules:

- "chlorine" defaults to `powder_chlorine` (your granular cal-hypo) unless the note says "liquid" or "gallon" → then `liquid_chlorine`.
- "acid" / "muriatic" / "pH down" → `muriatic_acid` (gal).
- Multiple chemicals in one note are extracted separately.
- If no amount is found, the note is skipped (no guessing).
- If the chemical has no purchase history, quantity is still recorded but line_cost = 0.

### 2. Backfill script (one-time)

An admin-only page at `/admin/inventory/backfill` that:

1. Loads all services where `chemicals_cost = 0` and `chemicals_added` is not empty.
2. Runs the parser and previews what will be written per service (chemical, quantity, unit, unit cost, line cost) with a "not parsed" list for review.
3. On confirm, writes `service_chemical_usage` rows and updates `services.chemicals_cost` in a batch.
4. Safe to re-run: it skips services that already have `service_chemical_usage` rows.

### 3. UI reflection

Nothing else to change — the admin client view and `ServiceCostChart` already read `chemicals_cost` and `service_chemical_usage`, so once the backfill runs, past months will populate automatically.

## What the plan will NOT do

- Won't invent chemicals or amounts that aren't in the note.
- Won't backfill costs for chemicals you've never logged a purchase for (they'll show $0 until you add a purchase). If you want, I can also assign a fallback price per chemical you type in.
- Won't change how new services are recorded.

## Open question before I build

The parser is a best-effort read of your old notes. Two ways to run it:

- **Preview then apply (recommended)** — you review the parse table and click Apply. Anything that looks wrong you fix inline first.
- **Auto-apply** — I run it once, you spot-check after.

I'll go with preview-then-apply unless you say otherwise.
