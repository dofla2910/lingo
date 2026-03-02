/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

const appShellHandler = createHandlerBoundToURL("/index.html");
registerRoute(
  new NavigationRoute(appShellHandler, {
    denylist: [/^\/api\//],
  }),
);

registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new StaleWhileRevalidate({
    cacheName: "google-fonts-stylesheets",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 8,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 8,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
    ],
  }),
);

function parsePushPayload(event) {
  if (!event?.data) return {};
  try {
    return event.data.json();
  } catch (_jsonErr) {
    try {
      return JSON.parse(event.data.text());
    } catch (_textErr) {
      return {};
    }
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  const title = String(payload?.title || "Lingo • Nút chạm");
  const body = String(payload?.body || "Người ấy vừa nhớ bạn.");
  const targetUrl = String(payload?.url || "/");
  const icon = String(payload?.icon || "/icons/icon-192.png");
  const badge = String(payload?.badge || "/icons/icon-192.png");
  const tag = String(payload?.tag || "lingo-ping");

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      renotify: true,
      requireInteraction: false,
      data: {
        url: targetUrl,
        pingId: payload?.pingId || "",
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = String(event.notification?.data?.url || "/");

  event.waitUntil(
    (async () => {
      const openClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of openClients) {
        const url = String(client?.url || "");
        if (!url) continue;
        if (url.includes(self.location.origin)) {
          if (typeof client.navigate === "function") {
            await client.navigate(targetUrl);
          }
          await client.focus();
          client.postMessage({
            type: "lingo-push-click",
            url: targetUrl,
          });
          return;
        }
      }

      await self.clients.openWindow(targetUrl);
    })(),
  );
});
