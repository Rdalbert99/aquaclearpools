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

// Live handles for the running registration, kept at module level so any screen
// can ask "is there a newer deployment?" on demand (the Refresh app button).
let registrationRef: ServiceWorkerRegistration | null = null;
let updateSWRef: ((reloadPage?: boolean) => Promise<void>) | null = null;

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
      registrationRef = registration ?? null;
      updateSWRef = updateSW;
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

  updateSWRef = updateSW;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type UpdateCheckResult =
  | "updated" // a newer deployment was found and the app is reloading with it
  | "latest" // asked the server, nothing newer exists
  | "offline" // no connection right now
  | "unavailable" // no service worker here (editor preview / plain dev tab)
  | "error"; // the check itself failed

/** True when an on-demand update check is possible in this context. */
export function isUpdateCheckAvailable(): boolean {
  return registrationRef !== null && updateSWRef !== null;
}

/**
 * Immediately asks the server whether a newer deployment was published, and if
 * one is waiting, swaps to it and reloads. Resolves "updated" only while the
 * page is already navigating away.
 */
export async function checkForUpdateNow(): Promise<UpdateCheckResult> {
  const registration = registrationRef;
  const updateSW = updateSWRef;
  if (!registration || !updateSW) return "unavailable";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";

  const applyIfWaiting = async () => {
    if (!registration.waiting) return false;
    await updateSW(true);
    return true;
  };

  // A newer version may already be waiting from an earlier background check.
  if (await applyIfWaiting()) return "updated";

  try {
    await registration.update();
  } catch {
    return "error";
  }

  // Give the freshly fetched worker time to install and go waiting.
  const started = Date.now();
  while (Date.now() - started < 20000) {
    if (await applyIfWaiting()) return "updated";
    if (registration.installing) {
      await sleep(200);
      continue;
    }
    // Nothing installing: allow a beat for a late install, then conclude.
    if (Date.now() - started > 1500) break;
    await sleep(200);
  }
  return "latest";
}
