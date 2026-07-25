/**
 * Single, guarded entry point for service worker registration.
 *
 * The service worker must NEVER register in development or inside the Lovable
 * editor preview: a stale app-shell cache there can serve deleted chunks and
 * white-screen the preview. `?sw=off` is a field kill switch that unregisters
 * any existing registration.
 */

const SW_URL = "/sw.js";

const isPreviewHost = (hostname: string) =>
  hostname.startsWith("id-preview--") ||
  hostname.startsWith("preview--") ||
  hostname === "lovableproject.com" ||
  hostname.endsWith(".lovableproject.com") ||
  hostname === "lovableproject-dev.com" ||
  hostname.endsWith(".lovableproject-dev.com") ||
  hostname === "beta.lovable.dev" ||
  hostname.endsWith(".beta.lovable.dev");

const isRefusedContext = () => {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  if (isPreviewHost(window.location.hostname)) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
};

const unregisterExisting = async () => {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      registrations
        .filter((registration) => {
          const scriptURL =
            registration.active?.scriptURL ||
            registration.waiting?.scriptURL ||
            registration.installing?.scriptURL ||
            "";
          return scriptURL.endsWith(SW_URL);
        })
        .map((registration) => registration.unregister()),
    );
  } catch {
    /* nothing we can do */
  }
};

export type UpdateHandlers = {
  onUpdateAvailable: (applyUpdate: () => void) => void;
  onReady?: () => void;
};

// How often to look for a newer deployment while the app stays open.
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;

export async function registerServiceWorker(handlers: UpdateHandlers) {
  if (isRefusedContext()) {
    await unregisterExisting();
    return;
  }

  const { registerSW } = await import("virtual:pwa-register");

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      handlers.onUpdateAvailable(() => updateSW(true));
    },
    onOfflineReady() {
      handlers.onReady?.();
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;

      const checkForUpdate = () => {
        if (navigator.onLine) registration.update().catch(() => undefined);
      };

      window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") checkForUpdate();
      });
      window.addEventListener("online", checkForUpdate);
    },
  });
}
