import { get, readable, writable } from "svelte/store";
import {
  createDefaultState,
  migrateState,
  normalizeEvent,
  normalizePerson,
  uid,
} from "./schema.js";

const FIREBASE_DATABASE_URL_OVERRIDE =
  "https://lingo-84f93-default-rtdb.asia-southeast1.firebasedatabase.app";
const FIREBASE_APP_NAME = "lingo-svelte-client";

const stateStore = writable(createDefaultState());
const metaStore = writable({
  ready: false,
  loading: true,
  status: "connecting", // connecting | synced | saving | error
  roomId: "",
  error: "",
  source: "firebase-rtdb",
});

export const lingoState = { subscribe: stateStore.subscribe };
export const lingoMeta = { subscribe: metaStore.subscribe };

export const lingoNow = readable(Date.now(), (set) => {
  set(Date.now());
  const timer = setInterval(() => set(Date.now()), 1000);
  return () => clearInterval(timer);
});

const remote = {
  inited: false,
  initPromise: null,
  app: null,
  db: null,
  ref: null,
  listener: null,
  clientId: `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  lastSeenUpdatedAt: 0,
  pendingWrite: Promise.resolve(),
  readyResolve: null,
};

function cloneState(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function setMeta(patch) {
  metaStore.update((prev) => ({ ...prev, ...patch }));
}

function currentMeta() {
  return get(metaStore);
}

function currentState() {
  return get(stateStore);
}

function sanitizeRoomId(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[.#$/[\]]/g, "_")
    .slice(0, 80);
}

async function resolveRoomId() {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const queryRoom = sanitizeRoomId(params.get("room") || params.get("code") || "");
    if (queryRoom) return queryRoom;
  }

  try {
    const authRes = await fetch("/api/auth/me", { credentials: "include" });
    if (!authRes.ok) return null;
    const authData = await authRes.json();
    if (!authData?.user) return null;

    const res = await fetch("/api/pair/me", { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    const roomId = sanitizeRoomId(data?.room?.roomId || data?.room?.code || "");
    return roomId || null;
  } catch {
    return null;
  }
}

async function loadFirebaseConfig() {
  const fallback = { databaseURL: FIREBASE_DATABASE_URL_OVERRIDE };
  let cfg = null;

  try {
    const res = await fetch("/api/firebase-config", { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      cfg = data?.firebaseConfig && typeof data.firebaseConfig === "object" ? { ...data.firebaseConfig } : null;
    }
  } catch {
    // Will validate below and return a helpful error if config is incomplete.
  }

  cfg = cfg || {};
  if (FIREBASE_DATABASE_URL_OVERRIDE) cfg.databaseURL = FIREBASE_DATABASE_URL_OVERRIDE;
  if (!cfg.databaseURL && fallback.databaseURL) cfg.databaseURL = fallback.databaseURL;

  const missing = ["apiKey", "authDomain", "projectId", "appId", "databaseURL"].filter((k) => !cfg[k]);
  if (missing.length) {
    throw new Error(
      `Thiếu Firebase client config (${missing.join(", ")}). Hãy đảm bảo backend /api/firebase-config trả config đúng project và FIREBASE_DATABASE_URL.`,
    );
  }
  return cfg;
}

function getFirebaseGlobal() {
  const fb = typeof window !== "undefined" ? window.firebase : null;
  if (!fb || typeof fb.initializeApp !== "function" || typeof fb.database !== "function") {
    throw new Error("Firebase SDK chưa sẵn sàng. Kiểm tra script CDN trong index.html.");
  }
  return fb;
}

function ensureFirebaseApp(config) {
  const fb = getFirebaseGlobal();
  const existing = Array.isArray(fb.apps) ? fb.apps.find((app) => app.name === FIREBASE_APP_NAME) : null;
  const app = existing || fb.initializeApp(config, FIREBASE_APP_NAME);
  return { fb, app, db: fb.database(app) };
}

function unwrapRemotePayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.state && typeof raw.state === "object") {
    return {
      state: migrateState(raw.state),
      updatedAt: Number(raw.updatedAt || 0),
      clientId: typeof raw.clientId === "string" ? raw.clientId : "",
    };
  }
  return {
    state: migrateState(raw),
    updatedAt: Number(raw.updatedAt || 0),
    clientId: typeof raw.clientId === "string" ? raw.clientId : "",
  };
}

function wrapRemotePayload(state) {
  return {
    version: 1,
    updatedAt: Date.now(),
    clientId: remote.clientId,
    state: migrateState(state),
  };
}

function friendlyFirebaseError(err, fallback) {
  const msg = String(err?.message || "");
  if (msg.includes("PERMISSION_DENIED") || msg.toLowerCase().includes("permission_denied")) {
    return "Firebase Realtime Database tu choi truy cap. Kiem tra Rules va dam bao ban dang vao dung phong (?room=CODE) hoac da dang nhap va ghep cap.";
  }
  return msg || fallback;
}

async function writeRemoteState(nextState) {
  if (!remote.ref) throw new Error("Khong the luu vi chua co ket noi Firebase hop le.");
  const normalized = migrateState(nextState);
  stateStore.set(normalized); // optimistic update

  remote.pendingWrite = remote.pendingWrite
    .catch(() => {})
    .then(async () => {
      setMeta({ status: "saving", error: "" });
      const payload = wrapRemotePayload(normalized);
      await remote.ref.set(payload);
      remote.lastSeenUpdatedAt = Math.max(remote.lastSeenUpdatedAt, Number(payload.updatedAt || 0));
      setMeta({ status: "synced", error: "" });
      return payload;
    })
    .catch((err) => {
      console.error(err);
      setMeta({ status: "error", error: friendlyFirebaseError(err, "Khong the luu Firebase.") });
      throw err;
    });

  return remote.pendingWrite;
}

async function ensureWritableConnection() {
  if (!remote.ref && !remote.inited) {
    try {
      await initLingoSharedStateBridge();
    } catch {
      // Error state is exposed via meta store and handled below.
    }
  } else if (!remote.ref && remote.initPromise) {
    try {
      await remote.initPromise;
    } catch {
      // Error state is exposed via meta store and handled below.
    }
  }

  const meta = currentMeta();
  if (meta.status === "error") {
    throw new Error(meta.error || "Khong the ghi du lieu Firebase.");
  }
  if (!remote.ref) {
    throw new Error(meta.error || "Chua xac dinh duoc phong du lieu Firebase.");
  }
}

async function persistState(next) {
  if (!currentMeta().ready) {
    throw new Error("Dang ket noi Firebase. Vui long thu lai sau vai giay.");
  }
  await ensureWritableConnection();
  return writeRemoteState(next);
}

function updateState(mutator) {
  const draft = cloneState(currentState());
  mutator(draft);
  return persistState(draft);
}

async function seedDefaultRemoteIfEmpty() {
  const seed = createDefaultState();
  await remote.ref.set(wrapRemotePayload(seed));
  stateStore.set(seed);
}

function attachRemoteListener() {
  if (!remote.ref) throw new Error("Firebase ref chưa sẵn sàng.");
  if (remote.listener) {
    remote.ref.off("value", remote.listener);
    remote.listener = null;
  }

  let firstSeen = false;

  remote.listener = async (snapshot) => {
    try {
      const val = snapshot.val();
      if (!val) {
        await seedDefaultRemoteIfEmpty();
        setMeta({ ready: true, loading: false, status: "synced", error: "" });
        if (!firstSeen && remote.readyResolve) remote.readyResolve();
        firstSeen = true;
        return;
      }

      const payload = unwrapRemotePayload(val);
      if (!payload?.state) throw new Error("Dữ liệu Firebase không hợp lệ.");

      remote.lastSeenUpdatedAt = Math.max(remote.lastSeenUpdatedAt, payload.updatedAt || 0);
      stateStore.set(payload.state);
      setMeta({ ready: true, loading: false, status: "synced", error: "" });

      if (!firstSeen && remote.readyResolve) remote.readyResolve();
      firstSeen = true;
    } catch (err) {
      console.error(err);
      remote.inited = false;
      remote.initPromise = null;
      remote.readyResolve = null;
      setMeta({
        ready: true,
        loading: false,
        status: "error",
        error: friendlyFirebaseError(err, "Không thể đọc dữ liệu Firebase."),
      });
      if (!firstSeen && remote.readyResolve) remote.readyResolve();
      firstSeen = true;
    }
  };

  remote.ref.on("value", remote.listener, (err) => {
    console.error(err);
    setMeta({
      ready: true,
      loading: false,
      status: "error",
      error: friendlyFirebaseError(err, "Mất kết nối Firebase."),
    });
    if (remote.readyResolve) remote.readyResolve();
  });
}

export const lingoActions = {
  refresh() {
    return currentState();
  },
  getState() {
    return currentState();
  },
  saveState(next) {
    return persistState(next);
  },
  saveCoupleSettings(input) {
    return updateState((draft) => {
      draft.settings = draft.settings || {};
      draft.couple = draft.couple || {};
      draft.settings.startDate = typeof input.startDate === "string" ? input.startDate : "";
      draft.couple.personA = normalizePerson(input.personA || draft.couple.personA, "a");
      draft.couple.personB = normalizePerson(input.personB || draft.couple.personB, "b");
    });
  },
  saveStartDate(startDate) {
    return updateState((draft) => {
      draft.settings = draft.settings || {};
      draft.settings.startDate = typeof startDate === "string" ? startDate : "";
    });
  },
  upsertEvent(input) {
    return updateState((draft) => {
      draft.events = Array.isArray(draft.events) ? draft.events : [];
      const nowIso = new Date().toISOString();
      const payload = normalizeEvent({
        id: input.id || uid("evt"),
        title: input.title,
        category: input.category,
        date: input.date,
        repeatAnnual: !!input.repeatAnnual,
        note: input.note || "",
        createdAt: input.createdAt || nowIso,
        updatedAt: nowIso,
      });
      if (!payload) throw new Error("Ngày sự kiện không hợp lệ.");

      const idx = draft.events.findIndex((e) => e.id === payload.id);
      if (idx >= 0) {
        const prev = draft.events[idx];
        draft.events[idx] = {
          ...prev,
          ...payload,
          createdAt: prev.createdAt || payload.createdAt,
          updatedAt: nowIso,
        };
      } else {
        draft.events.push(payload);
      }
    });
  },
  deleteEvent(id) {
    return updateState((draft) => {
      draft.events = (Array.isArray(draft.events) ? draft.events : []).filter((e) => e.id !== id);
    });
  },
  markMilestoneCelebrationShown(milestoneId) {
    if (!milestoneId) return Promise.resolve(currentState());
    return updateState((draft) => {
      draft.celebrations = draft.celebrations || {};
      const shown = Array.isArray(draft.celebrations.shownMilestoneIds)
        ? draft.celebrations.shownMilestoneIds.filter((v) => typeof v === "string")
        : [];
      if (!shown.includes(milestoneId)) shown.push(milestoneId);
      draft.celebrations.shownMilestoneIds = shown;
    });
  },
  resetAll() {
    return persistState(createDefaultState());
  },
  exportJsonString() {
    return JSON.stringify(currentState(), null, 2);
  },
  exportJsonFile() {
    if (typeof document === "undefined" || typeof URL === "undefined") return false;
    const blob = new Blob([this.exportJsonString()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeDate = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `lingo-backup-${safeDate}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  },
  importJsonText(text) {
    let parsed;
    try {
      parsed = JSON.parse(String(text || ""));
    } catch (_err) {
      throw new Error("Tệp JSON không hợp lệ.");
    }
    return persistState(migrateState(parsed));
  },
};

export async function initLingoSharedStateBridge() {
  if (remote.inited && remote.initPromise) return remote.initPromise;

  remote.inited = true;
  setMeta({ loading: true, ready: false, status: "connecting", error: "" });

  remote.initPromise = new Promise(async (resolve, reject) => {
    try {
      remote.readyResolve = resolve;
      const [config, roomId] = await Promise.all([loadFirebaseConfig(), resolveRoomId()]);
      const finalRoomId = sanitizeRoomId(roomId || "");
      if (!finalRoomId) {
        throw new Error("Chưa xác định được phòng dữ liệu. Hãy đăng nhập + ghép cặp hoặc mở link với `?room=CODE6KYTU`.");
      }
      const { db, app } = ensureFirebaseApp(config);
      remote.app = app;
      remote.db = db;
      remote.ref = db.ref(`lingoRooms/${finalRoomId}`);
      setMeta({ roomId: finalRoomId, source: "firebase-rtdb" });
      attachRemoteListener();
    } catch (err) {
      console.error(err);
      remote.inited = false;
      remote.initPromise = null;
      remote.readyResolve = null;
      setMeta({
        ready: true,
        loading: false,
        status: "error",
        error: friendlyFirebaseError(err, "Không thể khởi tạo Firebase."),
      });
      reject(err);
      return;
    }
  });

  return remote.initPromise;
}

export function destroyLingoSharedStateBridge() {
  if (remote.ref && remote.listener) {
    try {
      remote.ref.off("value", remote.listener);
    } catch (err) {
      console.warn(err);
    }
  }
  remote.listener = null;
  remote.ref = null;
  remote.db = null;
  remote.app = null;
  remote.readyResolve = null;
  remote.inited = false;
  remote.initPromise = null;
}
