
## Chemical Inventory & Cost Tracking

Track chemical purchases, calculate per-unit costs, roll those costs into every service call, and show admins cost-per-client charts. Prices stay hidden from clients.

### 1. Database (new tables)

**`chemical_inventory_purchases`** — every purchase you log
- `id`, `chemical_name` (text, e.g. "Liquid Chlorine", "Muriatic Acid", "Cal-Hypo", "Sodium Bicarb", "Soda Ash", "Stabilizer", "Salt")
- `unit` (text: `gallon` or `pound`)
- `quantity` numeric (amount purchased in that unit)
- `total_cost` numeric (what you paid)
- `unit_cost` numeric (generated: total_cost / quantity)
- `purchased_at` timestamptz, `notes`, `created_by`

**`service_chemical_usage`** — chemicals used on a specific service call
- `id`, `service_id` (FK → services), `chemical_name`, `unit`, `quantity_used`, `unit_cost_snapshot`, `line_cost` (generated)

Add `chemicals_cost` numeric column to `services` = sum of the service's `line_cost` rows.

RLS: admin + tech read/write on both tables; clients blocked. Grants for `authenticated` + `service_role`.

### 2. Admin — Inventory page (`/admin/inventory`)

- Table of all purchases with running current unit cost per chemical (weighted average of remaining stock).
- "Log purchase" form: pick chemical, unit auto-fills (gallon vs pound per your dosage standard), qty, total cost.
- Summary card per chemical: on-hand qty (purchased − used), current avg unit cost.

### 3. Field Service — cost preview

In `FieldService.tsx`, when tech enters chemical dosages (existing granular/liquid inputs), auto-fetch the current unit cost and show a live "This service cost: $X.XX" breakdown line. On complete, insert `service_chemical_usage` rows and save `chemicals_cost` on the service.

### 4. Admin — Client cost chart

On the client detail page, add a "Service cost history" card next to the readings chart:
- Bar chart of per-service `chemicals_cost` over time.
- Monthly totals table ("July 2026: 4 services · $46.50").
- Only visible to admin/tech, never to the client view.

### 5. Out of scope for this pass
Multi-vendor tracking, tax/shipping split, low-stock alerts, PDF exports — can follow up later.

Confirm and I'll build it.
