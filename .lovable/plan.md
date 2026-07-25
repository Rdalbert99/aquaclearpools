# Convert Aqua Clear into an installable PWA

No redesign, no schema changes, no auth/role changes, no route changes. Everything below is additive packaging plus one important fix to a risky service worker that already exists in your project.

## What I found today

- `index.html` already has a manifest link, theme color, and iOS tags.
- `public/manifest.json` exists but references `/icon-192x192.png` and `/icon-512x512.png` (those files exist), while `index.html` points `apple-touch-icon` at `/icons/icon-192.png` — **that folder does not exist**, so the iPhone home-screen icon is currently broken.
- `public/sw.js` is a hand-written **cache-first** service worker registered unconditionally in `src/main.tsx`. This is the single biggest risk in the app right now: it can serve technicians a stale version of the app indefinitely after you publish, and it also runs inside the Lovable preview.
- 60+ routes across public site, Admin, Technician, and Client areas — all stay exactly as they are.

## What I intend to change

**1. Replace the risky service worker (highest value)**
- Generate the service worker with `vite-plugin-pwa` (Workbox) at the same `/sw.js` path so already-installed phones pick up the replacement.
- HTML navigations use network-first (never stale pages); only hashed JS/CSS/image assets are cached for offline shell + fast loads.
- Registration moves into a single guarded wrapper that refuses to register in dev, in the Lovable editor preview, and inside iframes, and supports `?sw=off` as a kill switch to unregister if anything ever goes wrong in the field.
- Supabase API calls are never cached, so no stale customer/service data.

**2. Manifest + icons + splash**
- Update `manifest.json`: name, short name, `display: standalone`, theme/background color matching your existing blue, `id`, `scope`, maskable icon entries, and app shortcuts to Schedule / Clients.
- Generate proper 192/512 (regular + maskable) icons and an `apple-touch-icon` from the existing Aqua Clear logo, and fix the broken `/icons/...` reference in `index.html`.
- iOS splash comes from the manifest name/background color + apple meta tags already present.

**3. Update detection and forced refresh**
- `registerType: "autoUpdate"` plus a small non-intrusive banner: "A new version of Aqua Clear is available — Update now." One tap reloads into the new build.
- Periodic update check while the app is open (every ~15 min and on tab focus), so a technician working all day gets prompted rather than silently running an old build.

**4. Version display and What's New**
- A generated build version (from `package.json` version + build timestamp) exposed to the app.
- Version shown on the Profile/Settings page (small text, no layout change).
- New route `/whats-new` with a simple release-notes list read from a `src/releaseNotes.ts` file I maintain as we ship. After an update, users see a one-time "What's new in this version" link/toast; the page is also reachable from the version text.

**5. Phone polish (light touch only)**
- Add safe-area padding and `viewport-fit=cover` so content clears the iPhone notch/home bar in standalone mode.
- Bottom navigation for Admin/Tech/Client **only on small screens in the app shell** — same links your current mobile menu has, no changes to desktop navbar or page layouts.
- Ensure tap targets in that bottom bar are 44px+.
- Camera and GPS: your photo upload inputs get `capture` support and the route map keeps using the browser geolocation API — both already work in standalone PWAs; no new permissions flow.

## Risks and how I'll contain them

| Risk | Mitigation |
| --- | --- |
| Existing cache-first SW has already cached old files on your techs' devices | New SW ships at the same `/sw.js` path with `skipWaiting` + cleanup of the old `acp-v1` cache, so the first visit after publish evicts it |
| Offline shell hides real errors (e.g. tech thinks a service saved offline) | No offline write queue. Offline = app shell loads and shows a clear "no connection" state; saves still require network, exactly like today |
| Bottom nav could crowd existing mobile pages | Mobile-only, fixed height, with matching bottom padding added to the app shell; no changes inside any page component |
| iOS caches manifest fields at install time | I set `start_url`/`scope`/`id` correctly now (`/`), so no future reinstall is needed |
| Service worker in Lovable preview causing white screens | Registration is hard-blocked on preview/iframe/dev hostnames |

## Not included (tell me if you want them)

- Offline data entry / background sync for service records.
- Native app store builds (that's the separate Capacitor path).
- Push notifications (separate messaging worker; your SMS/email flow is untouched).

## Technical detail

- Add `vite-plugin-pwa` with `injectRegister: null`, `devOptions.enabled: false`, `registerType: "autoUpdate"`, `filename: "sw.js"`, navigation fallback excluding `/~oauth` and Supabase paths.
- New files: `src/pwa/registerServiceWorker.ts`, `src/components/pwa/UpdatePrompt.tsx`, `src/components/pwa/InstallPrompt.tsx`, `src/components/layout/MobileBottomNav.tsx`, `src/pages/WhatsNew.tsx`, `src/releaseNotes.ts`, new icon assets.
- Edited files: `vite.config.ts`, `index.html`, `public/manifest.json`, `src/main.tsx`, `src/App.tsx` (one added route + mount prompts), `src/pages/Profile.tsx` (version line), delete hand-written `public/sw.js` source in favor of the generated one.
- Note: `src/components/security/SecurityHeader.tsx` injects a CSP with `default-src 'self'` — I'll verify the service worker and manifest still load under it and add `worker-src 'self'` / `manifest-src 'self'` if needed.

Approve and I'll implement it in this order: SW + manifest/icons → update prompt → version/What's New → mobile bottom nav, verifying the app builds and renders after each step.