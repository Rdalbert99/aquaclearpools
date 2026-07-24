# All-Clients Map with Technician Color Coding

## Goal
Add a new map view showing every client pinned on the map, with pin color determined by their assigned technician. Admins can filter by tech; technicians see all pins but their own are highlighted.

## What to build

### 1. New shared component: `src/components/maps/AllClientsMap.tsx`
- Reuses the Leaflet + geocoding pattern from `src/components/tech/RouteMap.tsx` (Nominatim, `bestAddress`, marker cluster, spiderfy popups).
- Props:
  - `clients`: full client list (with `assigned_technician_id` + address fields + linked profile address).
  - `technicians`: `{ id, name }[]` used for color assignment and the legend.
  - `currentTechId?`: when provided (tech view), that tech's pin color is highlighted (larger/bold ring) and appears first in the legend.
- Assign each technician a stable color from a preset palette (hash by tech id so colors don't shuffle between renders). "Unassigned" gets a neutral gray.
- Uses colored `L.divIcon` markers instead of the default blue pin so color is visible at a glance.
- Popup content: client name, address (tap-to-map), pool details, assigned tech name, and links to Details / Call / Start Service (tech only).
- Legend below the map: colored dot + tech name + count of clients. Clicking a legend row filters the map to that tech (toggle).

### 2. Admin filter dropdown
- When rendered on the admin page, add a `<Select>` above the map: "All technicians" / one item per tech / "Unassigned". Filters the marker set.
- Technicians don't get the dropdown — they always see all pins, but the legend still lets them isolate one tech.

### 3. Wire it into the pages
- **Tech dashboard** (`src/pages/tech/Dashboard.tsx`): add a new card "All Clients Map" below the existing per-day Route Map. Load all clients (not just needing-service) and the tech users list. Pass `currentTechId={user.id}`.
- **Admin dashboard** (`src/pages/admin/Dashboard.tsx`): add the same card with the tech filter dropdown enabled.

### 4. Data loading
- Clients: `select * from clients where status = 'Active'` plus the joined `client_user` profile address (same shape `RouteMap` already consumes).
- Technicians: `select id, name from users where role = 'tech'` (used for palette + labels + admin dropdown).

## Out of scope
- No changes to the existing per-day `RouteMap` on the schedule.
- No changes to routing/navigation directions — this map is for locating, not routing.
- No DB schema changes; uses existing `clients.assigned_technician_id`.

## Technical notes
- Palette: 10–12 distinguishable Tailwind-friendly hex colors; deterministic assignment via `technicians.findIndex(...)` so order in the list drives color.
- Geocoding results cached in component state keyed by normalized address string so switching filters doesn't re-hit Nominatim.
- Cluster + spiderfy retained so dense neighborhoods stay readable.
