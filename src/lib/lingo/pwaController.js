import { get, writable } from "svelte/store";
import { registerSW } from "virtual:pwa-register";

const PWA_UPDATE_INTERVAL_MS = 60 * 1000;

const initialState = {
  ready: false,
  isIOS: false,
  isStandalone: false,
  canInstallPrompt: false,
  showIOSGuide: false,
};

const pwaStore = writable(initialState);
export const pwaState = { subscribe: pwaStore.subscribe };

let inited = false;
let deferredPrompt = null;
let updateSW = null;
let cleanupFns = [];

function setState(patch) {
  pwaStore.update((prev) => ({ ...prev, ...patch }));
}

function detectStandaloneMode() {
  if (typeof window === "undefined") return false;
  const mediaStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches;
  return Boolean(mediaStandalone || window.navigator.standalone === true);
}

function detectIOSDevice() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const iOSUA = /iPad|iPhone|iPod/i.test(ua);
  const iPadDesktopMode = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return iOSUA || iPadDesktopMode;
}

function mountInstallLifecycle({ onInstalled } = {}) {
  const onBeforeInstallPrompt = (event) => {
    event.preventDefault();
    deferredPrompt = event;
    setState({ canInstallPrompt: true });
  };

  const onAppInstalled = () => {
    deferredPrompt = null;
    setState({
      canInstallPrompt: false,
      isStandalone: true,
      showIOSGuide: false,
    });
    if (typeof onInstalled === "function") onInstalled();
  };

  const onVisibilityChange = () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "visible") {
      setState({ isStandalone: detectStandaloneMode() });
    }
  };

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);
  document.addEventListener("visibilitychange", onVisibilityChange);

  cleanupFns.push(() => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt));
  cleanupFns.push(() => window.removeEventListener("appinstalled", onAppInstalled));
  cleanupFns.push(() => document.removeEventListener("visibilitychange", onVisibilityChange));
}

function mountServiceWorkerLifecycle({ onOfflineReady, onRegisterError } = {}) {
  updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      const intervalId = window.setInterval(() => {
        registration.update().catch(() => {});
      }, PWA_UPDATE_INTERVAL_MS);

      const onVisible = () => {
        if (document.visibilityState === "visible") {
          registration.update().catch(() => {});
        }
      };

      document.addEventListener("visibilitychange", onVisible);

      cleanupFns.push(() => {
        clearInterval(intervalId);
        document.removeEventListener("visibilitychange", onVisible);
      });
    },
    onNeedRefresh() {
      updateSW?.(true);
    },
    onOfflineReady() {
      if (typeof onOfflineReady === "function") onOfflineReady();
    },
    onRegisterError(error) {
      if (typeof onRegisterError === "function") onRegisterError(error);
    },
  });
}

export function initPwaController(options = {}) {
  if (inited) return;
  if (typeof window === "undefined" || typeof document === "undefined") return;

  inited = true;
  setState({
    ready: true,
    isIOS: detectIOSDevice(),
    isStandalone: detectStandaloneMode(),
  });

  mountInstallLifecycle({
    onInstalled: options?.onInstalled,
  });
  mountServiceWorkerLifecycle({
    onOfflineReady: options?.onOfflineReady,
    onRegisterError: options?.onRegisterError,
  });
}

export function openIOSGuide() {
  setState({ showIOSGuide: true });
}

export function closeIOSGuide() {
  setState({ showIOSGuide: false });
}

export async function requestPwaInstall() {
  const snapshot = get(pwaState);

  if (snapshot.canInstallPrompt && deferredPrompt) {
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setState({ canInstallPrompt: false });

    if (choice?.outcome === "accepted") return { status: "accepted" };
    return { status: "dismissed" };
  }

  if (snapshot.isIOS) {
    openIOSGuide();
    return { status: "ios_guide" };
  }

  return { status: "unsupported" };
}

export function destroyPwaController() {
  cleanupFns.forEach((fn) => {
    try {
      fn();
    } catch (_err) {
      // noop
    }
  });
  cleanupFns = [];
  deferredPrompt = null;
  updateSW = null;
  inited = false;
  pwaStore.set(initialState);
}
