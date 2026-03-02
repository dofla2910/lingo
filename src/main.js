import "./app.css";
import "./styles/lingo.css";
import App from "./App.svelte";
import { initPwaController } from "$lib/lingo/pwaController.js";

initPwaController({
  onOfflineReady: () => {
    console.info("[Lingo PWA] Offline cache is ready.");
  },
  onRegisterError: (error) => {
    console.error("[Lingo PWA] Service worker register error:", error);
  },
});

const app = new App({
  target: document.getElementById("app"),
});

export default app;
