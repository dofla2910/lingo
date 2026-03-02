const VAPID_PUBLIC_KEY = String(import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY || "").trim();

let pushSyncCacheKey = "";
let pushSyncCacheAt = 0;
let permissionPromptAttempted = false;
const PUSH_SYNC_DEBOUNCE_MS = 60_000;

function nowMs() {
  return Date.now();
}

function base64ToUint8Array(base64String) {
  const safe = String(base64String || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (safe.length % 4)) % 4);
  const raw = atob(safe + pad);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function canUsePushApi() {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  if (!("Notification" in window)) return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  return true;
}

function normalizeSubscription(json) {
  const endpoint = String(json?.endpoint || "").trim();
  const p256dh = String(json?.keys?.p256dh || "").trim();
  const auth = String(json?.keys?.auth || "").trim();
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

async function ensurePermission(prompt = false) {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  if (!prompt || permissionPromptAttempted) return "default";
  permissionPromptAttempted = true;
  return Notification.requestPermission();
}

export async function syncPushSubscriptionForRoom(client, roomUuid, userId, options = {}) {
  const promptPermission = !!options?.promptPermission;
  const safeRoom = String(roomUuid || "").trim();
  const safeUser = String(userId || "").trim();
  if (!client || !safeRoom || !safeUser) return { ok: false, reason: "missing_context" };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "missing_vapid_public_key" };
  if (!canUsePushApi()) return { ok: false, reason: "unsupported_platform" };

  const cacheKey = `${safeRoom}:${safeUser}`;
  if (cacheKey === pushSyncCacheKey && nowMs() - pushSyncCacheAt < PUSH_SYNC_DEBOUNCE_MS) {
    return { ok: true, skipped: true };
  }

  const permission = await ensurePermission(promptPermission);
  if (permission !== "granted") {
    return { ok: false, reason: permission === "denied" ? "permission_denied" : "permission_default" };
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  if (!subscription) return { ok: false, reason: "subscription_failed" };

  const json = subscription.toJSON();
  const normalized = normalizeSubscription(json);
  if (!normalized) return { ok: false, reason: "invalid_subscription_payload" };

  const { error } = await client.from("lingo_push_subscriptions").upsert(
    {
      endpoint: normalized.endpoint,
      user_id: safeUser,
      room_id: safeRoom,
      p256dh: normalized.p256dh,
      auth: normalized.auth,
      subscription: json,
      enabled: true,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent || null : null,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;

  pushSyncCacheKey = cacheKey;
  pushSyncCacheAt = nowMs();
  return { ok: true };
}

export async function invokeSendPingPush(client, payload) {
  if (!client) return { ok: false, reason: "missing_client" };
  try {
    const { data, error } = await client.functions.invoke("send-ping-push", { body: payload || {} });
    if (error) throw error;
    return { ok: true, data: data || null };
  } catch (err) {
    console.warn("[Lingo Push] invoke send-ping-push failed:", err?.message || err);
    return { ok: false, reason: "invoke_failed", error: err };
  }
}
