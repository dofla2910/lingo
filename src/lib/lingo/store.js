import { get, readable, writable } from "svelte/store";
import {
  createDefaultState,
  migrateState,
  normalizeEvent,
  normalizePerson,
  uid,
} from "./schema.js";
import {
  getCurrentAuthUser,
  getMemberRoomByCode,
  getMyPairRoom,
  getSupabaseClient,
  getSupabaseConfigError,
  isNoRowsError,
  isSchemaMissingError,
  sanitizeRoomCode,
} from "./supabaseClient.js";

const stateStore = writable(createDefaultState());
const metaStore = writable({
  ready: false,
  loading: true,
  status: "connecting", // connecting | synced | saving | draft | error
  roomId: "",
  error: "",
  source: "supabase-postgres",
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
  client: null,
  roomUuid: "",
  roomCode: "",
  channel: null,
  readyResolve: null,
  pendingWrite: Promise.resolve(),
  lastSeenUpdatedAt: 0,
  draftState: null,
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

function getQueryRoomCode() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return sanitizeRoomCode(params.get("room") || params.get("code") || "");
}

function wrapRemotePayload(state) {
  return {
    version: 1,
    updatedAt: Date.now(),
    state: migrateState(state),
  };
}

function unwrapRemotePayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.state && typeof raw.state === "object") {
    return {
      state: migrateState(raw.state),
      updatedAt: Number(raw.updatedAt || 0),
    };
  }
  return {
    state: migrateState(raw),
    updatedAt: Number(raw.updatedAt || 0),
  };
}

function isMissingRoomMessage(message) {
  const msg = String(message || "").toLowerCase();
  return msg.includes("phòng dữ liệu") || msg.includes("phong du lieu") || msg.includes("room");
}

function friendlySupabaseError(err, fallback) {
  const msg = String(err?.message || "");
  const lower = msg.toLowerCase();

  if (isSchemaMissingError(err)) {
    return "Ứng dụng chưa sẵn sàng dữ liệu. Vui lòng thử lại sau.";
  }
  if (lower.includes("permission denied") || lower.includes("rls") || lower.includes("violates row-level security")) {
    return "Không thể truy cập dữ liệu phòng. Hãy đăng nhập lại hoặc kiểm tra mã phòng.";
  }
  if (lower.includes("invalid api key") || lower.includes("jwt")) {
    return "Thiết lập đăng nhập hoặc phiên làm việc chưa hợp lệ.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Không thể kết nối dữ liệu. Hãy kiểm tra mạng.";
  }
  return msg || fallback;
}

function setDraftState(nextState, message = "") {
  const normalized = migrateState(nextState);
  remote.draftState = cloneState(normalized);
  stateStore.set(normalized);
  setMeta({
    ready: true,
    loading: false,
    status: "draft",
    roomId: remote.roomCode || "",
    error:
      message ||
      "Chưa kết nối phòng chung. Dữ liệu đang ở bộ nhớ tạm của phiên hiện tại cho đến khi bạn đăng nhập và ghép cặp.",
  });
  return normalized;
}

async function resolveRoomCode(client) {
  const queryCode = getQueryRoomCode();
  if (queryCode) return queryCode;

  try {
    const user = await getCurrentAuthUser(client);
    if (!user) return "";
    const row = await getMyPairRoom(client);
    return sanitizeRoomCode(row?.code || "");
  } catch {
    return "";
  }
}

async function fetchRoomRowForCurrentMember(client, code) {
  const clean = sanitizeRoomCode(code);
  if (!clean) return null;
  const row = await getMemberRoomByCode(clean, client);
  return row || null;
}

async function fetchRoomStateRow(client, roomUuid) {
  const { data, error } = await client
    .from("lingo_room_states")
    .select("room_id,payload,updated_at")
    .eq("room_id", roomUuid)
    .maybeSingle();
  if (error && !isNoRowsError(error)) throw error;
  return data || null;
}

async function upsertRoomState(client, roomUuid, payload) {
  const user = await getCurrentAuthUser(client).catch(() => null);
  const { error } = await client
    .from("lingo_room_states")
    .upsert(
      {
        room_id: roomUuid,
        payload,
        updated_by: user?.id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "room_id" },
    );
  if (error) throw error;
  return payload;
}

async function seedRoomStateIfEmpty(client, roomUuid) {
  const seed = remote.draftState || currentState() || createDefaultState();
  const payload = wrapRemotePayload(seed);
  await upsertRoomState(client, roomUuid, payload);
  remote.lastSeenUpdatedAt = Math.max(remote.lastSeenUpdatedAt, Number(payload.updatedAt || 0));
  stateStore.set(migrateState(seed));
}

async function attachRoomStateChannel(client, roomUuid) {
  if (remote.channel) {
    try {
      await client.removeChannel(remote.channel);
    } catch (_err) {
      // noop
    }
    remote.channel = null;
  }

  const channel = client
    .channel(`lingo-room-state:${roomUuid}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "lingo_room_states",
        filter: `room_id=eq.${roomUuid}`,
      },
      (payload) => {
        try {
          const raw = payload?.new?.payload || payload?.record?.payload || null;
          const wrapped = unwrapRemotePayload(raw);
          if (!wrapped?.state) return;
          remote.lastSeenUpdatedAt = Math.max(remote.lastSeenUpdatedAt, wrapped.updatedAt || 0);
          stateStore.set(wrapped.state);
          setMeta({ status: "synced", error: "" });
        } catch (err) {
          console.error(err);
          setMeta({
            status: "error",
            error: friendlySupabaseError(err, "Không thể tải dữ liệu mới của phòng."),
          });
        }
      },
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        setMeta({
          ready: true,
          loading: false,
          status: "error",
          error: "Kết nối cập nhật thời gian thực đang bị gián đoạn. Hãy thử tải lại trang.",
        });
      }
    });

  remote.channel = channel;
}

async function connectToRoomByCode(client, code) {
  const user = await getCurrentAuthUser(client);
  if (!user) {
    throw new Error("Hãy đăng nhập trước khi truy cập phòng dữ liệu.");
  }

  const roomRow = await fetchRoomRowForCurrentMember(client, code);
  if (!roomRow) {
    throw new Error("Không tìm thấy phòng hoặc bạn chưa ghép cặp vào phòng này.");
  }

  remote.roomUuid = String(roomRow.id || "");
  remote.roomCode = sanitizeRoomCode(roomRow.code || code);

  let stateRow = await fetchRoomStateRow(client, remote.roomUuid);
  if (!stateRow) {
    await seedRoomStateIfEmpty(client, remote.roomUuid);
    stateRow = await fetchRoomStateRow(client, remote.roomUuid);
  }

  if (stateRow?.payload) {
    const wrapped = unwrapRemotePayload(stateRow.payload);
    if (wrapped?.state) {
      remote.lastSeenUpdatedAt = Math.max(remote.lastSeenUpdatedAt, wrapped.updatedAt || 0);
      stateStore.set(wrapped.state);
      remote.draftState = null;
    }
  }

  await attachRoomStateChannel(client, remote.roomUuid);

  setMeta({
    ready: true,
    loading: false,
    status: "synced",
    roomId: remote.roomCode,
    error: "",
    source: "supabase-postgres",
  });
}

async function writeRemoteState(nextState) {
  if (!remote.client || !remote.roomUuid) {
    return setDraftState(nextState);
  }

  const normalized = migrateState(nextState);
  stateStore.set(normalized); // optimistic update

  remote.pendingWrite = remote.pendingWrite
    .catch(() => {})
    .then(async () => {
      setMeta({ status: "saving", error: "" });
      const payload = wrapRemotePayload(normalized);
      await upsertRoomState(remote.client, remote.roomUuid, payload);
      remote.lastSeenUpdatedAt = Math.max(remote.lastSeenUpdatedAt, Number(payload.updatedAt || 0));
      setMeta({ status: "synced", error: "" });
      return payload;
    })
    .catch((err) => {
      console.error(err);
      const message = friendlySupabaseError(err, "Không thể lưu dữ liệu.");
      setMeta({ status: "error", error: message });
      throw err;
    });

  return remote.pendingWrite;
}

async function persistState(next) {
  const normalized = migrateState(next);

  const cfgErr = getSupabaseConfigError();
  if (cfgErr) {
    setMeta({
      ready: true,
      loading: false,
      status: "error",
      error: "Tính năng lưu dữ liệu tạm thời chưa sẵn sàng.",
      roomId: remote.roomCode || "",
      source: "supabase-postgres",
    });
    stateStore.set(normalized);
    throw new Error(`Cấu hình lưu dữ liệu chưa sẵn sàng: ${cfgErr}`);
  }

  if (!remote.roomUuid) {
    if (!remote.inited || remote.initPromise) {
      try {
        await initLingoSharedStateBridge();
      } catch {
        // handled below
      }
    }
    if (!remote.roomUuid) {
      const message = currentMeta().error || "Chưa xác định được phòng dữ liệu.";
      if (isMissingRoomMessage(message)) {
        return setDraftState(normalized, message);
      }
      throw new Error(message);
    }
  }

  return writeRemoteState(normalized);
}

function updateState(mutator) {
  const draft = cloneState(currentState());
  mutator(draft);
  return persistState(draft);
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
    } catch {
      throw new Error("Tệp JSON không hợp lệ.");
    }
    return persistState(migrateState(parsed));
  },
};

export async function initLingoSharedStateBridge() {
  if (remote.inited && remote.initPromise) return remote.initPromise;

  const cfgErr = getSupabaseConfigError();
  if (cfgErr) {
    setMeta({
      ready: true,
      loading: false,
      status: "error",
      roomId: remote.roomCode || "",
      source: "supabase-postgres",
      error: "Tính năng lưu dữ liệu tạm thời chưa sẵn sàng.",
    });
    throw new Error(`Cấu hình lưu dữ liệu chưa sẵn sàng: ${cfgErr}`);
  }

  remote.inited = true;
  setMeta({ loading: true, ready: false, status: "connecting", error: "" });

  remote.initPromise = new Promise(async (resolve, reject) => {
    try {
      remote.readyResolve = resolve;
      const client = getSupabaseClient();
      remote.client = client;

      const roomCode = await resolveRoomCode(client);
      const finalRoomCode = sanitizeRoomCode(roomCode || "");
      remote.roomCode = finalRoomCode;

      if (!finalRoomCode) {
        setMeta({
          ready: true,
          loading: false,
          status: "draft",
          roomId: "",
          source: "supabase-postgres",
          error: "Chưa xác định được phòng dữ liệu. Hãy đăng nhập + ghép cặp hoặc mở link với ?room=CODE6KYTU",
        });
        remote.readyResolve = null;
        resolve();
        return;
      }

      await connectToRoomByCode(client, finalRoomCode);
      remote.readyResolve = null;
      resolve();
    } catch (err) {
      console.error(err);
      remote.inited = false;
      remote.initPromise = null;
      remote.readyResolve = null;
      setMeta({
        ready: true,
        loading: false,
        status: "error",
        roomId: remote.roomCode || "",
        source: "supabase-postgres",
        error: friendlySupabaseError(err, "Không thể khởi tạo kết nối dữ liệu."),
      });
      reject(err);
    }
  });

  return remote.initPromise;
}

export function destroyLingoSharedStateBridge() {
  if (remote.client && remote.channel) {
    try {
      remote.client.removeChannel(remote.channel);
    } catch (err) {
      console.warn(err);
    }
  }
  remote.channel = null;
  remote.roomUuid = "";
  remote.roomCode = "";
  remote.readyResolve = null;
  remote.inited = false;
  remote.initPromise = null;
}
