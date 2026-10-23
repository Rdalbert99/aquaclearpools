# App updates on iPhone: audit and fix plan

## Short answer
You should not have to delete and re-add the Home Screen app for every update. Right now, though, the app can keep showing an old version until it happens to notice the new one, and the "update available" banner waits for someone to tap it.

## What I found (read-only)
- The server side is fine. The live site tells browsers to always re-check the main page and the update helper file (`no-cache`), and code files get new names on every publish.
- The app's update helper keeps a saved copy of the main page and serves it before it checks the internet. So an installed app opens the old version first.
- New versions wait until someone taps "Update now" (prompt mode). If the banner is missed or closed, the old version keeps running.
- The app looks for updates every 15 minutes and when it comes back to the screen. iPhone Home Screen apps often pause in the background, so these checks can be missed or delayed. "Refresh app" forces a check, but only if the update helper is running properly.
- The version label is v1.2.0 and is changed by hand, so it doesn't always change when a new version is published.
- The service visit form doesn't save a draft, so an automatic reload in the middle of a visit would lose unsaved readings.

## Recommended fix (needs your approval)
1. Always load the main page fresh from the internet when online. Use the saved copy only when offline.
2. Update safely on its own:
   - If no form has unsaved changes, switch to the new version quietly the next time the app opens or comes back to the screen.
   - If a service visit or another form is in progress, never reload. Show a small banner instead: "New version ready — will update after you save" with an "Update now" button.
3. Save the service visit as a draft on the phone while it's being filled in, so even a forced reload or crash doesn't lose readings. The draft is cleared after a successful save.
4. Show the version in the profile menu, using the version number plus the build date and time added automatically on each publish, so it's always clear which version is running.
5. Keep "Refresh app" and the `?sw=off` reset as backups.
6. One last reinstall may be needed so the phone picks up the new update behavior. After that, updates should arrive on their own.

## Testing
- Automated tests: the "is a form in progress?" rule (never reload while there are unsaved changes), saving/restoring/clearing visit drafts, and the version label format.
- Browser check on the published build: open the app, publish a test change, return to the app and confirm it switches over. Repeat while a visit form is open and confirm it shows the banner instead of reloading.
- On your iPhone: open the Home Screen app after a publish and confirm the new version number appears without reinstalling. I can't test this on a real phone.

## Technical details
- vite.config.ts: remove `html` from precache `globPatterns` (index.html is currently precached and served cache-first by the precache route at `/`). Keep NetworkFirst for navigations, set `registerType: "autoUpdate"` / `skipWaiting` handled in the wrapper, and keep CacheFirst for hashed assets.
- registerServiceWorker.ts: apply a waiting worker when the page is visible and the form-in-progress check is false. Also check for updates on `pageshow`/`focus` (iOS standalone).
- New small module for tracking unsaved changes (register/unregister per form). FieldService registers itself and saves the visit draft to localStorage, keyed by client and date.
- Build-time `__BUILD_ID__` (from Vite `define`) is shown with APP_VERSION.
- No backend, data or publish changes.
