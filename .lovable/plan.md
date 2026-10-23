# QuickBooks page: findings and minimal fix

## Verified facts
- The page exists in the preview at `/admin/quickbooks` (set up in App.tsx).
- Only admins can open it. Techs and customers are blocked.
- No menu, dashboard tile, or Billing page link points to it, so you can only reach it by typing the address.
- The live site (aquaclear-pools.lovable.app / getaquaclear.com) does not include the page yet. It hasn't been published since the page was added.

## Minimal fix
1. Add a "QuickBooks" item to the admin menu, next to Billing (desktop and phone menus).
2. Add a "Test QuickBooks Connection" link on the Billing page.
3. Publish when you're ready. Until then, you can test it in the preview at `/admin/quickbooks`.

## Technical details
- `src/components/layout/Navbar.tsx`: add `{ label: 'QuickBooks', icon: PlugZap, path: '/admin/quickbooks' }` to the admin items.
- `src/pages/admin/Billing.tsx`: add a `<Link to="/admin/quickbooks">` button.
- Nothing else changes, and nothing in QuickBooks is touched.
