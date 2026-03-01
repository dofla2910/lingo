import { tick } from "svelte";
import { derived, get, writable } from "svelte/store";
import { buildMilestoneView, parseDateTime } from "./utils.js";

function shallowEqualObject(a, b) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

function sameCelebrationState(a, b) {
  const aActive = a?.active?.id || "";
  const bActive = b?.active?.id || "";
  if (aActive !== bActive) return false;
  const aQueue = Array.isArray(a?.queue) ? a.queue : [];
  const bQueue = Array.isArray(b?.queue) ? b.queue : [];
  if (aQueue.length !== bQueue.length) return false;
  for (let i = 0; i < aQueue.length; i += 1) {
    if (aQueue[i]?.id !== bQueue[i]?.id) return false;
  }
  return true;
}

function normalizeSystemFont(value) {
  if (value === "paytone_one") return "paytone_one";
  if (value === "itim") return "itim";
  if (value === "pangolin") return "pangolin";
  if (value === "pacifico") return "pacifico";
  if (value === "prata" || value === "pacifico_prata") return "prata";
  return "be_vietnam_pro";
}

function stripEmptyHash() {
  if (typeof window === "undefined") return;
  if (window.location.hash !== "#") return;
  const cleanPath = `${window.location.pathname || "/"}${window.location.search || ""}`;
  history.replaceState({}, "", cleanPath);
}

function setupGlobalModalScrollLock() {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") {
    return () => {};
  }

  const body = document.body;
  const root = document.documentElement;
  let locked = false;
  let lockScrollY = 0;
  let prevPaddingRight = "";
  let rafId = 0;

  const hasOpenModal = () => !!document.querySelector(".modal.open");

  const applyLockState = () => {
    rafId = 0;
    const shouldLock = hasOpenModal();
    if (shouldLock === locked) return;

    if (shouldLock) {
      lockScrollY = window.scrollY || window.pageYOffset || 0;
      prevPaddingRight = body.style.paddingRight || "";

      const scrollbarGap = Math.max(0, window.innerWidth - root.clientWidth);
      if (scrollbarGap > 0) {
        body.style.paddingRight = `${scrollbarGap}px`;
      }

      body.classList.add("modal-open");
      body.style.top = `-${lockScrollY}px`;
    } else {
      body.classList.remove("modal-open");
      body.style.top = "";
      body.style.paddingRight = prevPaddingRight;
      window.scrollTo(0, lockScrollY);
    }

    locked = shouldLock;
  };

  const scheduleApply = () => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(applyLockState);
  };

  const observer = new MutationObserver(scheduleApply);
  observer.observe(body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  });

  const onResize = () => {
    if (!locked) return;
    const scrollbarGap = Math.max(0, window.innerWidth - root.clientWidth);
    body.style.paddingRight = scrollbarGap > 0 ? `${scrollbarGap}px` : prevPaddingRight;
  };

  window.addEventListener("resize", onResize, { passive: true });
  scheduleApply();

  return () => {
    if (rafId) window.cancelAnimationFrame(rafId);
    observer.disconnect();
    window.removeEventListener("resize", onResize);
    if (locked) {
      body.classList.remove("modal-open");
      body.style.top = "";
      body.style.paddingRight = prevPaddingRight;
      window.scrollTo(0, lockScrollY);
    }
  };
}

export function createAppShellController({
  lingoState,
  lingoMeta,
  lingoNow,
  lingoActions,
  initBridge,
  destroyBridge,
  toast,
}) {
  const BOOTSTRAP_TIMEOUT_MS = 10000;

  const uiState = writable({
    settingsOpen: false,
    wizardOpen: false,
    wizardRequired: false,
    pairingOpen: false,
    currentPath: "/",
    lastAutoPromptRoomId: "",
    pairingAutoPrompted: false,
    authStateLoading: true,
    isAuthenticated: false,
    bootstrapTimedOut: false,
  });

  const celebrationState = writable({
    queue: [],
    active: null,
  });

  let removePopstateListener = () => {};
  let removeModalScrollLock = () => {};
  let effectUnsub = () => {};
  let initFailedNotified = false;
  let bootstrapTimeoutId = 0;

  const viewModel = derived([lingoState, lingoMeta, lingoNow, uiState], ([$state, $meta, $now, $ui]) => {
    const hasStartDate = !!($state?.settings?.startDate || "").trim();
    const roomId = String($meta?.roomId || "").trim();
    const hasRoom = !!roomId;
    const syncReady = !!$meta?.ready;
    const syncStatus = $meta?.status || "connecting";
    const canPromptWizard = syncReady && syncStatus !== "error";
    const authPanelMode = $state?.ui?.authPanelMode === "standard" ? "standard" : "ultra_minimal";
    const systemFont = normalizeSystemFont($state?.ui?.systemFont);
    const isPrivacyRoute = $ui.currentPath === "/privacy" || $ui.currentPath === "/privacy/";
    const showAppLoading = !isPrivacyRoute && !!$meta.loading && !$meta.ready;
    const celebrationStart = parseDateTime($state?.settings?.startDate || "");
    const celebrationView = buildMilestoneView(celebrationStart, new Date($now));
    const shownMilestoneIds = Array.isArray($state?.celebrations?.shownMilestoneIds)
      ? $state.celebrations.shownMilestoneIds
      : [];

    return {
      ...$ui,
      isPrivacyRoute,
      showAppLoading,
      hasStartDate,
      roomId,
      hasRoom,
      syncReady,
      syncStatus,
      canPromptWizard,
      canShowMainContent: hasRoom,
      showSetupChoice: hasRoom && !hasStartDate,
      authPanelMode,
      systemFont,
      celebrationView,
      shownMilestoneIds,
    };
  });

  function patchUi(patch) {
    uiState.update((prev) => {
      const partial = typeof patch === "function" ? patch(prev) : patch;
      const next = { ...prev, ...(partial || {}) };
      return shallowEqualObject(prev, next) ? prev : next;
    });
  }

  function setCurrentPath() {
    const nextPath = typeof window === "undefined" ? "/" : window.location.pathname || "/";
    patchUi({ currentPath: nextPath });
  }

  function applyFontTheme(systemFont) {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-font-theme", systemFont);
  }

  function applyOrchestration(snapshot) {
    const ui = get(uiState);
    let nextUi = ui;

    const mergeUi = (patch) => {
      const candidate = { ...nextUi, ...patch };
      if (!shallowEqualObject(nextUi, candidate)) {
        nextUi = candidate;
      }
    };

    if (!snapshot.hasRoom && nextUi.lastAutoPromptRoomId) {
      mergeUi({ lastAutoPromptRoomId: "" });
    }

    if (snapshot.hasRoom && nextUi.pairingAutoPrompted) {
      mergeUi({ pairingAutoPrompted: false });
    }

    if (
      !snapshot.hasRoom &&
      snapshot.canPromptWizard &&
      !nextUi.pairingAutoPrompted &&
      !nextUi.pairingOpen &&
      !nextUi.wizardOpen &&
      !nextUi.settingsOpen
    ) {
      mergeUi({ pairingAutoPrompted: true, pairingOpen: true });
      toast("Mở kết nối cặp đôi để tạo hoặc tham gia phòng chung.");
    }

    if (
      snapshot.hasRoom &&
      snapshot.canPromptWizard &&
      !snapshot.hasStartDate &&
      snapshot.roomId !== nextUi.lastAutoPromptRoomId
    ) {
      mergeUi({
        lastAutoPromptRoomId: snapshot.roomId,
        wizardRequired: true,
        wizardOpen: true,
      });
      toast("Bắt đầu với Wizard để thiết lập cặp đôi.");
    }

    if (
      !snapshot.isPrivacyRoute &&
      !nextUi.authStateLoading &&
      !nextUi.isAuthenticated &&
      !nextUi.pairingOpen &&
      !nextUi.wizardOpen &&
      !nextUi.settingsOpen
    ) {
      mergeUi({ pairingOpen: true });
    }

    if (!shallowEqualObject(ui, nextUi)) {
      uiState.set(nextUi);
    }

    const celebration = get(celebrationState);
    let nextCelebration = celebration;
    const setCelebration = (patch) => {
      nextCelebration = { ...nextCelebration, ...patch };
    };

    if (!snapshot.hasStartDate) {
      if (nextCelebration.queue.length || nextCelebration.active) {
        setCelebration({ queue: [], active: null });
      }
    } else {
      const achieved = snapshot.celebrationView?.items?.filter((item) => item.achieved) || [];
      if (achieved.length) {
        const shownSet = new Set(snapshot.shownMilestoneIds);
        const queuedSet = new Set(nextCelebration.queue.map((item) => item.id));
        const activeId = nextCelebration.active?.id || "";
        const toQueue = achieved.filter((item) => !shownSet.has(item.id) && !queuedSet.has(item.id) && item.id !== activeId);
        if (toQueue.length) {
          setCelebration({ queue: [...nextCelebration.queue, ...toQueue] });
        }
      }

      if (!nextCelebration.active && nextCelebration.queue.length && !nextUi.settingsOpen && !nextUi.wizardOpen) {
        setCelebration({
          active: nextCelebration.queue[0],
          queue: nextCelebration.queue.slice(1),
        });
      }

      if (nextCelebration.active && snapshot.shownMilestoneIds.includes(nextCelebration.active.id)) {
        setCelebration({ active: null });
      }
    }

    if (!sameCelebrationState(celebration, nextCelebration)) {
      celebrationState.set(nextCelebration);
    }
  }

  function clearBootstrapTimeout() {
    if (!bootstrapTimeoutId) return;
    clearTimeout(bootstrapTimeoutId);
    bootstrapTimeoutId = 0;
  }

  function syncBootstrapTimeout(snapshot) {
    if (snapshot.showAppLoading) {
      if (!bootstrapTimeoutId && !snapshot.bootstrapTimedOut) {
        bootstrapTimeoutId = setTimeout(() => {
          bootstrapTimeoutId = 0;
          patchUi({ bootstrapTimedOut: true });
        }, BOOTSTRAP_TIMEOUT_MS);
      }
      return;
    }

    clearBootstrapTimeout();
    if (snapshot.bootstrapTimedOut) {
      patchUi({ bootstrapTimedOut: false });
    }
  }

  function openSettings() {
    patchUi({ settingsOpen: true });
  }

  function closeSettings() {
    patchUi({ settingsOpen: false });
  }

  function openPairing() {
    patchUi({ pairingOpen: true });
  }

  function closePairing() {
    patchUi({ pairingOpen: false });
  }

  function openWizard(forceRequired = false) {
    const hasStartDate = !!(get(lingoState)?.settings?.startDate || "").trim();
    patchUi({
      pairingOpen: false,
      wizardRequired: forceRequired || !hasStartDate,
      wizardOpen: true,
    });
  }

  function closeWizard() {
    patchUi({ wizardOpen: false });
  }

  function setAuthState(detail = {}) {
    patchUi({
      authStateLoading: !!detail.loading,
      isAuthenticated: !!detail.authenticated,
    });
  }

  async function reconnectRoom(roomId = "", options = {}) {
    try {
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        const nextRoom = String(roomId || "").trim();
        if (nextRoom) {
          url.searchParams.set("room", nextRoom);
          url.searchParams.delete("code");
        } else if (options.clearRoomQuery) {
          url.searchParams.delete("room");
          url.searchParams.delete("code");
        }
        history.replaceState({}, "", url);
        stripEmptyHash();
      }

      destroyBridge();
      await initBridge();

      if (roomId) {
        toast(`Đã kết nối phòng ${roomId}.`);
      }
    } catch (err) {
      console.error(err);
      toast(err?.message || "Không thể kết nối lại dữ liệu của cặp đôi.");
    }
  }

  async function closeCelebration() {
    const active = get(celebrationState).active;
    if (!active) return;
    try {
      await lingoActions.markMilestoneCelebrationShown(active.id);
      celebrationState.update((prev) => ({ ...prev, active: null }));
    } catch (err) {
      toast(err?.message || "Không thể lưu trạng thái cột mốc.");
    }
  }

  async function handleWizardComplete(authPairingPanelRef) {
    patchUi({ wizardRequired: false, wizardOpen: false });
    await tick();
    try {
      await authPairingPanelRef?.handleWizardCompletedAutoPair?.();
    } catch (err) {
      console.error(err);
      toast(err?.message || "Không thể tự tạo mã ghép cặp sau Wizard.");
    }
  }

  async function retryBootstrap() {
    clearBootstrapTimeout();
    patchUi({ bootstrapTimedOut: false });
    try {
      destroyBridge();
      await initBridge();
    } catch (err) {
      console.error(err);
      toast(err?.message || "Không thể thử lại kết nối dữ liệu.");
    }
  }

  function mount() {
    stripEmptyHash();
    setCurrentPath();
    removeModalScrollLock = setupGlobalModalScrollLock();

    if (typeof window !== "undefined") {
      const onPopstate = () => setCurrentPath();
      window.addEventListener("popstate", onPopstate);
      removePopstateListener = () => window.removeEventListener("popstate", onPopstate);
    }

    effectUnsub = viewModel.subscribe((snapshot) => {
      applyFontTheme(snapshot.systemFont);
      syncBootstrapTimeout(snapshot);
      applyOrchestration(snapshot);
    });

    const snapshot = get(viewModel);
    if (snapshot.isPrivacyRoute) return;

    initBridge().catch((err) => {
      console.error(err);
      if (initFailedNotified) return;
      initFailedNotified = true;
      toast(err?.message || "Không thể kết nối dữ liệu.");
    });
  }

  function destroy() {
    clearBootstrapTimeout();
    effectUnsub?.();
    removePopstateListener?.();
    removeModalScrollLock?.();
    destroyBridge();
  }

  return {
    uiState,
    viewModel,
    celebrationState,
    openSettings,
    closeSettings,
    openPairing,
    closePairing,
    openWizard,
    closeWizard,
    setAuthState,
    reconnectRoom,
    closeCelebration,
    handleWizardComplete,
    retryBootstrap,
    mount,
    destroy,
  };
}
