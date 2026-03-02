import { buildPingMessage, resolveMissedCount } from "./pingUi.js";

export function createPingController({
  getViewSnapshot,
  getMetaSnapshot,
  sendPingAction,
  onToast,
  showPingNotification,
  getHeartRainRef,
  onBusyChange,
} = {}) {
  let pingBusy = false;
  let lastHandledPingId = "";
  let pendingPingCount = 0;
  let pendingPingMessage = "";
  let removeVisibilityListener = () => {};

  function setBusy(next) {
    pingBusy = !!next;
    if (typeof onBusyChange === "function") onBusyChange(pingBusy);
  }

  function burst(count) {
    const ref = typeof getHeartRainRef === "function" ? getHeartRainRef() : null;
    ref?.burst?.(count);
  }

  function flushPendingPingUi() {
    if (pendingPingCount <= 0) return;
    const message =
      pendingPingCount === 1
        ? pendingPingMessage
        : `B\u1ea1n c\u00f3 ${pendingPingCount} N\u00fat ch\u1ea1m m\u1edbi.`;
    burst(Math.min(28, 10 + pendingPingCount * 2));
    onToast?.(message, 3200);
    pendingPingCount = 0;
    pendingPingMessage = "";
  }

  async function sendPing() {
    if (pingBusy) return;
    const snapshot = getViewSnapshot?.();
    const meta = getMetaSnapshot?.();

    if (!snapshot?.hasRoom) {
      onToast?.("H\u00e3y k\u1ebft n\u1ed1i ph\u00f2ng \u0111\u1ec3 d\u00f9ng N\u00fat ch\u1ea1m.");
      return;
    }

    setBusy(true);
    try {
      await sendPingAction?.(snapshot.roomId, meta?.myUserId || "");
      burst(9);
      onToast?.("\u0110\u00e3 g\u1eedi m\u1ed9t nh\u1ecbp y\u00eau th\u01b0\u01a1ng.");
    } catch (err) {
      onToast?.(err?.message || "Kh\u00f4ng th\u1ec3 g\u1eedi N\u00fat ch\u1ea1m.");
    } finally {
      setBusy(false);
    }
  }

  async function handleIncomingPingIfNew(ping) {
    const pingId = String(ping?.id || "").trim();
    if (!pingId || pingId === lastHandledPingId) return;
    lastHandledPingId = pingId;

    const missedCount = resolveMissedCount(ping);
    const message = buildPingMessage(ping);
    const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";

    if (hidden) {
      pendingPingCount += missedCount;
      pendingPingMessage = message;
      await showPingNotification?.("Lingo \u2022 N\u00fat ch\u1ea1m", message);
      return;
    }

    burst(16);
    onToast?.(message, 3000);
  }

  function mount() {
    if (typeof document === "undefined") return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        flushPendingPingUi();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    removeVisibilityListener = () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  function destroy() {
    removeVisibilityListener();
    removeVisibilityListener = () => {};
  }

  return {
    sendPing,
    handleIncomingPingIfNew,
    mount,
    destroy,
    flushPendingPingUi,
  };
}
