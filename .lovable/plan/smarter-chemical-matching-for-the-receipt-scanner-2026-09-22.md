# Smarter chemical matching for the receipt scanner

Make the scanner understand that "Cal Hypo Shock", "Dry Tec", or "Swimtrine Plus" belong to Aqua Clear's own inventory items, let Randy correct any guess, and remember his corrections so the next invoice gets it right automatically.

## What changes for the user

On the Review Receipt screen each scanned line will show:

- A suggested inventory item with a short reason ("Matched by item code", "Learned from a past invoice", "Recognized as algaecide") and a confidence hint.
- A searchable "Assign to inventory item" picker listing every inventory item, so a suggestion can always be overridden.
- "+ Create new inventory item" right on the line, prefilled with the product name, chemical type, container size/unit and supplier SKU from the scan. Once created, the line assigns to it automatically.
- A clear "Unmatched — choose an item or create one" state; the line can never be left stuck.
- The conversion line ("1 × 100 lb bucket → adds 100 lbs") stays visible and editable.
- A "Remember this for next time" toggle (on by default) whenever the user changes the assignment.

The supplier's own wording stays intact: the purchase history keeps the invoice description, brand, vendor, SKU, price and receipt image, while the stock and cost land on the canonical inventory item.

## Technical design

### 1. Learned mappings table (migration)

`inventory_product_aliases`:
- `vendor` (nullable, lowercased), `sku` (nullable), `normalized_description`
- `chemical_id` (catalog slug), `source` ('user' | 'auto'), `hit_count`, `last_used_at`
- Unique index on (`vendor`, `sku`) where sku is present; unique on (`vendor`, `normalized_description`)
- GRANTs + RLS: staff (authenticated admins/techs) read and write, following the existing inventory tables' policy shape.

### 2. Canonical knowledge layer — `src/lib/chemical-aliases.ts`

A data table of canonical chemical families, each with:
- the catalog slug(s) it maps to (`powder_chlorine`, `algaecide`, …)
- synonym terms and brand names ("cal hypo", "calcium hypochlorite", "dry tec", "shock", "granular chlorine"; "swimtrine", "polyquat", "copper algaecide" → algaecide; equivalents for acid, alkalinity, CYA, clarifier, salt, etc.)
- a `chemistryType` guard (`chlorine_powder`, `chlorine_liquid`, `acid`, `alkalinity`, `algaecide`, `clarifier`, `stabilizer`, `hardness`, `salt`, `phosphate`) so lines are never merged just because words look alike — a candidate is rejected when its chemistry type conflicts.

This is a reusable table, not a pair of special cases; adding a new brand is one line of data.

### 3. Matching pipeline — extend `src/lib/receipt-import.ts`

Ordered resolution, first hit wins, each carrying a `matchSource` for the UI:
1. vendor + SKU in `inventory_product_aliases` (strongest, persistent)
2. SKU on the catalog item itself
3. vendor + normalized description alias
4. canonical alias/brand recognition from the knowledge layer, chemistry-type compatible
5. fuzzy token score against catalog labels, but only when chemistry types agree
6. otherwise `unmatched`

`matchSource` widens to `'vendor_sku' | 'sku' | 'alias' | 'canonical' | 'name' | 'none'`, with a confidence value for the badge.

### 4. Dialog changes — `ReceiptImportDialog.tsx`

- Load aliases alongside the catalog when the dialog opens and pass both into `toReviewLines`.
- Replace the plain Select with a searchable Command/Popover picker (large tap targets, full-width on mobile), grouped: suggestion first, then all items, then "+ Create new inventory item".
- Inline create panel prefilled from the scan (name, tracked-in unit derived from package unit, SKU, vendor, cost).
- On confirm, for every line whose assignment was set or changed by the user with "remember" on, upsert an alias row (vendor+SKU and vendor+description), incrementing `hit_count` on repeats.
- Purchase rows keep the canonical `chemical_id`/label; `inventory_receipt_items` keeps the raw description, SKU, package size and price as today. Existing duplicate-invoice warning and "nothing changes until Confirm" behavior are untouched.

### 5. Mobile

Line cards stack vertically, the assignment picker opens as a full-width sheet-style popover with a search field, and the conversion summary stays pinned under each line.

## Verification

Typecheck, then drive the review screen in a simulated iPhone viewport with a synthetic multi-line invoice (a Cal-Hypo shock line and a Swimtrine Plus line) to confirm suggestions, override, create-new, alias persistence on a second import, and unchanged confirm safeguards.
