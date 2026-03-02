import "./app.css";
import "./styles/lingo.css";
import App from "./App.svelte";
import { registerSW } from "virtual:pwa-register";

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;

    // Check for new service worker periodically and when app becomes visible.
    const intervalId = window.setInterval(() => {
      registration.update().catch(() => {});
    }, 60 * 1000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        registration.update().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("beforeunload", () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    });
  },
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    console.info("[Lingo PWA] Offline cache is ready.");
  },
  onRegisterError(error) {
    console.error("[Lingo PWA] Service worker register error:", error);
  },
});

const app = new App({
	target: document.getElementById("app"),
});

export default app;
