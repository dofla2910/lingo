import { get, writable } from "svelte/store";
import { registerSW } from "virtual:pwa-register";

const PWA_UPDATE_INTERVAL_MS = 60 * 1000;

const initialState = {
  ready: false,
  isIOS: false,
  isStandalone: false,
  canInstallPrompt: false,
  showIOSGuide: false,
  updateAvailable: false,
  updating: false,
  lastUpdateCheckAt: 0,
};

const pwaStore = writable(initialState);
export const pwaState = { subscribe: pwaStore.subscribe };

let inited = false;
let deferredPrompt = null;
let updateSW = null;
let swRegistration = null;
let isApplyingUpdate = false;
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

async function checkForUpdate() {
  if (!swRegistration) return false;

  setState({ lastUpdateCheckAt: Date.now() });

  try {
    await swRegistration.update();
  } catch (_err) {
    return false;
  }

  const waiting = !!swRegistration.waiting;
  if (waiting) {
    setState({ updateAvailable: true });
  }
  return waiting;
}

async function applyUpdateIfAvailable() {
  if (!updateSW || isApplyingUpdate) {
    return { status: "busy" };
  }

  if (!swRegistration?.waiting && !get(pwaState).updateAvailable) {
    return { status: "up_to_date" };
  }

  isApplyingUpdate = true;
  setState({ updating: true, updateAvailable: true });

  try {
    await updateSW(true);
    return { status: "updating" };
  } catch (error) {
    setState({ updating: false });
    return { status: "error", error };
  } finally {
    isApplyingUpdate = false;
  }
}

function triggerUpdateAvailable(autoApply = true) {
  setState({ updateAvailable: true });

  if (!autoApply) return;
  if (typeof document === "undefined") return;
  if (document.visibilityState !== "visible") return;

  applyUpdateIfAvailable();
}

function bindRegistrationLifecycle(registration) {
  if (!registration || typeof window === "undefined") return;

  swRegistration = registration;

  const onUpdateFound = () => {
    const installing = registration.installing;
    if (!installing) return;

    const onStateChange = () => {
      if (installing.state !== "installed") return;
      if (!window.navigator.serviceWorker?.controller) return;
      triggerUpdateAvailable(true);
    };

    installing.addEventListener("statechange", onStateChange);
  };

  const onControllerChange = () => {
    setState({ updateAvailable: false, updating: false });
  };

  registration.addEventListener("updatefound", onUpdateFound);
  window.navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);

  cleanupFns.push(() => registration.removeEventListener("updatefound", onUpdateFound));
  cleanupFns.push(() => window.navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange));

  if (registration.waiting && window.navigator.serviceWorker?.controller) {
    triggerUpdateAvailable(true);
  }
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

      bindRegistrationLifecycle(registration);

      checkForUpdate().then((hasUpdate) => {
        if (hasUpdate) triggerUpdateAvailable(true);
      });

      const intervalId = window.setInterval(() => {
        checkForUpdate().then((hasUpdate) => {
          if (hasUpdate) triggerUpdateAvailable(true);
        });
      }, PWA_UPDATE_INTERVAL_MS);

      const onVisible = () => {
        if (document.visibilityState !== "visible") return;
        checkForUpdate().then((hasUpdate) => {
          if (hasUpdate) triggerUpdateAvailable(true);
        });
      };

      document.addEventListener("visibilitychange", onVisible);

      cleanupFns.push(() => {
        clearInterval(intervalId);
        document.removeEventListener("visibilitychange", onVisible);
      });
    },
    onNeedRefresh() {
      triggerUpdateAvailable(true);
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

export async function requestPwaUpdate(options = {}) {
  const { forceCheck = true, apply = true } = options;

  if (!swRegistration || !updateSW) {
    return { status: "unsupported" };
  }

  if (forceCheck) {
    await checkForUpdate();
  }

  const snapshot = get(pwaState);
  const hasUpdate = snapshot.updateAvailable || !!swRegistration.waiting;

  if (!hasUpdate) {
    return { status: "up_to_date" };
  }

  if (!apply) {
    return { status: "available" };
  }

  return applyUpdateIfAvailable();
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
  swRegistration = null;
  isApplyingUpdate = false;
  inited = false;
  pwaStore.set(initialState);
}
