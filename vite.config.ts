import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    VitePWA({
      // The manifest is maintained by hand in public/manifest.json and linked from index.html
      manifest: false,
      injectRegister: null,
      registerType: "prompt",
      filename: "sw.js",
      devOptions: { enabled: false },
      workbox: {
        // Precache only the app shell (code + styles). Large images are cached
        // on demand by the CacheFirst asset route below.
        globPatterns: ["**/*.{js,css,html}", "icon-192x192.png", "manifest.json"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        // Never use a cache-first navigation fallback: HTML always goes to the
        // network first so technicians can't be served a stale app build.
        navigateFallback: undefined,
        runtimeCaching: [
          {
            // App shell / page navigations
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "acp-pages",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Same-origin hashed build assets
            urlPattern: ({ url, request, sameOrigin }) =>
              sameOrigin &&
              !url.pathname.startsWith("/~oauth") &&
              ["style", "script", "image", "font"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "acp-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
