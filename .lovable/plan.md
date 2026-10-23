# getaquaclear.com speed audit — findings and low-risk fix plan

## Findings (checked in code, files and data)
1. **Before/after photos are the main weight.** The homepage loads 10 PNG photos (about 0.6–3.0 MB each, roughly 21 MB total). That matches the 23 MB page size. They are PNGs, not compressed photos, and are not sized for phones.
2. **Logo is heavy.** The header logo is a 573 KB PNG (the dark version is 1 MB) shown at about 64 px, and it loads first on every page — likely part of the slow LCP. Unused extras: a 2.2 MB 3D logo in two places.
3. **All pages load in one bundle.** About 80 pages (admin, tech, QuickBooks, billing) are imported up front, so public visitors download staff code before the homepage appears.
4. **Install prompt.** It shows to every first-time mobile visitor at the bottom of the homepage until they tap X. Installed apps also get a "reinstall to refresh icon" banner once per version — outdated now that updates apply automatically.
5. **Missing pages.** The app does have a "Page not found" screen, but hosting always returns a normal "200" status (all single-page apps on this hosting do), so tools flag it as a soft 404. The screen also uses off-brand gray styling and doesn't stop search engines indexing it.
6. **Reviews dates are real data, not a bug.** 4 of 5 approved reviews were saved on 17 Feb 2026 (UTC), which shows as 2/16 in US time — they were entered together. One is from Aug 2025. No dates will be changed.

## Plan (no redesign; nothing touching customers, techs, admin, QuickBooks or app updates)
1. Convert the 10 before/after photos to compressed WebP at about 1200 px wide (expected ~150–250 KB each), add width/height and lazy loading, with the original kept as a fallback. Expected page weight: under 3 MB.
2. Make small WebP/PNG versions of the logo (~128 px, ~15 KB) for the header and footer; mark the hero image as the priority image.
3. Load staff pages only when opened (split admin, tech, billing and QuickBooks screens into separate downloads). Customer-facing and login pages stay instant. This does not change how the app updates on phones.
4. Install prompt: show only after a visitor's second visit or 30 seconds on site, never on the homepage first screen, never on login/signup; remove the outdated "reinstall to refresh icon" banner for installed apps.
5. Missing-page screen: add "noindex", use brand colors, and link to Home/Contact. A true 404 status needs server rendering, which is optional and not part of this plan.
6. Reviews: optional, show month and year ("February 2026") instead of an exact day so batch-entered reviews look natural. Real dates stay unchanged.
7. After the changes, run the tests, check the preview on mobile size, and re-run Lighthouse on the preview. Publishing only with your separate approval.

## Expected result
Mobile performance likely 80–90+, LCP around 2–3 s, page weight dropping from 23 MB to under 3 MB.
