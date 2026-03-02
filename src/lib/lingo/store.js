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
  getSupabaseConfigError,
  getUserProfilesByIds,
  isNoRowsError,
  isSchemaMissingError,
  sanitizeRoomCode,
  supabase,
} from "./supabaseClient.js";
import { invokeSendPingPush, syncPushSubscriptionForRoom } from "./webPushClient.js";

const stateStore = writable(createDefaultState());
const metaStore = writable({
  ready: false,
  loading: true,
  status: "connecting", // connecting | synced | saving | draft | error
  roomId: "",
  error: "",
  source: "supabase-postgres",
  myUserId: "",
  ownerProfile: null,
  partnerProfile: null,
});
const pingStore = writable(null);
const pingStatsStore = writable(createEmptyPingStats());

export const lingoState = { subscribe: stateStore.subscribe };
export const lingoMeta = { subscribe: metaStore.subscribe };
export const lingoPing = { subscribe: pingStore.subscribe };
export const lingoPingStats = { subscribe: pingStatsStore.subscribe };

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
  pingChannel: null,
  readyResolve: null,
  pendingWrite: Promise.resolve(),
  lastSeenUpdatedAt: 0,
  lastPingId: "",
  myUserId: "",
  seenPingIds: new Set(),
  lastSeenPingAtMs: 0,
  draftState: null,
};

function currentDateKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function createEmptyPingStats(dateKey = currentDateKey()) {
  return {
    dateKey,
    todayTotal: 0,
    todaySent: 0,
    todayReceived: 0,
  };
}

const PING_SEEN_KEY_PREFIX = "lingo_ping_seen_v1";

function buildPingSeenStorageKey(roomUuid, userId) {
  const safeRoom = String(roomUuid || "").trim();
  const safeUser = String(userId || "").trim();
  if (!safeRoom || !safeUser) return "";
  return `${PING_SEEN_KEY_PREFIX}:${safeRoom}:${safeUser}`;
}

function readPingSeenMs(roomUuid, userId) {
  if (typeof window === "undefined" || !window.localStorage) return 0;
  const key = buildPingSeenStorageKey(roomUuid, userId);
  if (!key) return 0;

  try {
    const raw = window.localStorage.getItem(key);
    const ts = Date.parse(String(raw || ""));
    return Number.isFinite(ts) ? ts : 0;
  } catch {
    return 0;
  }
}

function persistPingSeenMs(roomUuid, userId, nextMs) {
  if (typeof window === "undefined" || !window.localStorage) return;
  const key = buildPingSeenStorageKey(roomUuid, userId);
  if (!key || !Number.isFinite(nextMs) || nextMs <= 0) return;

  try {
    window.localStorage.setItem(key, new Date(nextMs).toISOString());
  } catch {
    // ignore storage failures in private mode / restricted contexts
  }
}

function markPingSeenAt(createdAt, roomUuid = remote.roomUuid, userId = remote.myUserId) {
  const ts = Date.parse(String(createdAt || ""));
  if (!Number.isFinite(ts)) return;
  if (ts <= remote.lastSeenPingAtMs) return;

  remote.lastSeenPingAtMs = ts;
  persistPingSeenMs(roomUuid, userId, ts);
}

function getTodayIsoRange(nowTs = Date.now()) {
  const now = new Date(nowTs);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return {
    dateKey: currentDateKey(nowTs),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

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

function normalizeProfileForMeta(profile) {
  if (!profile || typeof profile !== "object") return null;
  return {
    userId: String(profile.userId || "").trim(),
    name: String(profile.name || "").trim(),
    birthday: String(profile.birthday || "").trim(),
    gender: ["nam", "nu", "khac", "khong_tiet_lo"].includes(profile.gender) ? profile.gender : "khong_tiet_lo",
    avatarUrl: String(profile.avatarUrl || "").trim(),
  };
}

function fallbackMemberProfileFromRoomRow(roomRow, key = "owner") {
  if (!roomRow || typeof roomRow !== "object") return null;
  const userId = String(roomRow[`${key}_user_id`] || "").trim();
  if (!userId) return null;
  return normalizeProfileForMeta({
    userId,
    name: String(roomRow[`${key}_username`] || key),
    birthday: "",
    gender: "khong_tiet_lo",
    avatarUrl: String(roomRow[`${key}_avatar_url`] || ""),
  });
}

async function resolveRoomMemberProfiles(client, roomRow) {
  const ownerId = String(roomRow?.owner_user_id || "").trim();
  const partnerId = String(roomRow?.partner_user_id || "").trim();
  const ids = [ownerId, partnerId].filter(Boolean);
  const rows = ids.length ? await getUserProfilesByIds(ids, client).catch(() => []) : [];
  const byUserId = new Map(rows.map((p) => [String(p.userId || "").trim(), normalizeProfileForMeta(p)]));
  const ownerProfile = byUserId.get(ownerId) || fallbackMemberProfileFromRoomRow(roomRow, "owner");
  const partnerProfile = byUserId.get(partnerId) || fallbackMemberProfileFromRoomRow(roomRow, "partner");
  return { ownerProfile, partnerProfile };
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
  remote.lastPingId = "";
  remote.myUserId = "";
  remote.seenPingIds = new Set();
  remote.lastSeenPingAtMs = 0;
  pingStore.set(null);
  pingStatsStore.set(createEmptyPingStats());
  setMeta({
    ready: true,
    loading: false,
    status: "draft",
    roomId: remote.roomCode || "",
    myUserId: "",
    ownerProfile: null,
    partnerProfile: null,
    error:
      message ||
      "Chưa kết nối phòng chung. Dữ liệu đang ở bộ nhớ tạm của phiên hiện tại cho đến khi bạn đăng nhập và ghép cặp.",
  });
  return normalized;
}

function resolveMemberNameByUserId(meta, userId) {
  const target = String(userId || "").trim();
  if (!target) return "Người ấy";
  const ownerId = String(meta?.ownerProfile?.userId || "").trim();
  const partnerId = String(meta?.partnerProfile?.userId || "").trim();
  if (target === ownerId) return String(meta?.ownerProfile?.name || "").trim() || "Người ấy";
  if (target === partnerId) return String(meta?.partnerProfile?.name || "").trim() || "Người ấy";
  return "Người ấy";
}

function allowSelfPingForDebug() {
  if (!import.meta.env.DEV) return false;
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("ping_self") === "1";
}

function pushIncomingPing(raw) {
  const pingId = String(raw?.id || "").trim();
  const senderId = String(raw?.sender_id || "").trim();
  if (!pingId || !senderId) return;
  if (pingId === remote.lastPingId) return;
  const meta = currentMeta();
  const myUserId = String(meta?.myUserId || remote.myUserId || "").trim();
  if (myUserId && senderId === myUserId && !allowSelfPingForDebug()) return;

  markPingSeenAt(raw?.created_at);
  remote.lastPingId = pingId;
  pingStore.set({
    id: pingId,
    senderId,
    senderName: resolveMemberNameByUserId(meta, senderId),
    createdAt: raw?.created_at || new Date().toISOString(),
    receivedAt: Date.now(),
  });
}

async function initPingStatsForToday(client, roomUuid, myUserId = "") {
  if (!client || !roomUuid) {
    pingStatsStore.set(createEmptyPingStats());
    remote.seenPingIds = new Set();
    return;
  }

  try {
    const { dateKey, startIso, endIso } = getTodayIsoRange();
    const { data, error } = await client
      .from("lingo_pings")
      .select("id,sender_id,created_at")
      .eq("room_id", roomUuid)
      .gte("created_at", startIso)
      .lt("created_at", endIso);
    if (error) throw error;

    const safeMyUserId = String(myUserId || "").trim();
    const seen = new Set();
    const nextStats = createEmptyPingStats(dateKey);
    for (const row of Array.isArray(data) ? data : []) {
      const id = String(row?.id || "").trim();
      if (id) seen.add(id);
      nextStats.todayTotal += 1;
      const senderId = String(row?.sender_id || "").trim();
      if (senderId && safeMyUserId && senderId === safeMyUserId) {
        nextStats.todaySent += 1;
      } else {
        nextStats.todayReceived += 1;
      }
    }
    remote.seenPingIds = seen;
    pingStatsStore.set(nextStats);
  } catch (err) {
    console.warn("[Lingo Ping] Skip today stats bootstrap:", err?.message || err);
    remote.seenPingIds = new Set();
    pingStatsStore.set(createEmptyPingStats());
  }
}

async function fetchMissedPingsSinceLastSeen(client, roomUuid, myUserId = "") {
  const safeRoomUuid = String(roomUuid || "").trim();
  const safeMyUserId = String(myUserId || "").trim();
  if (!client || !safeRoomUuid || !safeMyUserId) return [];

  // First-time on this device: seed watermark "now" to avoid replaying old history.
  const storedSeenMs = readPingSeenMs(safeRoomUuid, safeMyUserId);
  if (!storedSeenMs) {
    const nowMs = Date.now();
    remote.lastSeenPingAtMs = nowMs;
    persistPingSeenMs(safeRoomUuid, safeMyUserId, nowMs);
    return [];
  }

  remote.lastSeenPingAtMs = storedSeenMs;
  const seenIso = new Date(storedSeenMs).toISOString();

  try {
    const { data, error } = await client
      .from("lingo_pings")
      .select("id,sender_id,created_at")
      .eq("room_id", safeRoomUuid)
      .neq("sender_id", safeMyUserId)
      .gt("created_at", seenIso)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length > 0) {
      const newest = rows[rows.length - 1];
      markPingSeenAt(newest?.created_at, safeRoomUuid, safeMyUserId);
    }
    return rows;
  } catch (err) {
    console.warn("[Lingo Ping] Skip missed ping catch-up:", err?.message || err);
    return [];
  }
}

function applyPingStatsRow(raw, myUserId = "") {
  const row = raw && typeof raw === "object" ? raw : null;
  if (!row) return;

  const id = String(row.id || "").trim();
  if (id) {
    if (remote.seenPingIds.has(id)) return;
    remote.seenPingIds.add(id);
  }

  const rowTs = new Date(row.created_at || Date.now()).getTime();
  if (!Number.isFinite(rowTs)) return;

  const todayKey = currentDateKey(Date.now());
  if (currentDateKey(rowTs) !== todayKey) return;

  const safeMyUserId = String(myUserId || remote.myUserId || currentMeta()?.myUserId || "").trim();
  const senderId = String(row.sender_id || "").trim();

  pingStatsStore.update((prev) => {
    const base = prev && typeof prev === "object" ? prev : createEmptyPingStats(todayKey);
    const current = base.dateKey === todayKey ? base : createEmptyPingStats(todayKey);
    return {
      dateKey: todayKey,
      todayTotal: (current.todayTotal || 0) + 1,
      todaySent: (current.todaySent || 0) + (safeMyUserId && senderId === safeMyUserId ? 1 : 0),
      todayReceived: (current.todayReceived || 0) + (safeMyUserId && senderId !== safeMyUserId ? 1 : 0),
    };
  });
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
  const meta = currentMeta();
  const canReuseDraft =
    !!remote.draftState ||
    (meta?.status === "draft" && !String(meta?.roomId || "").trim());
  const seed = canReuseDraft ? remote.draftState || currentState() || createDefaultState() : createDefaultState();
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

async function attachPingChannel(client, roomUuid) {
  if (remote.pingChannel) {
    try {
      await client.removeChannel(remote.pingChannel);
    } catch (_err) {
      // noop
    }
    remote.pingChannel = null;
  }

  const channel = client
    .channel(`lingo-pings:${roomUuid}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "lingo_pings",
        filter: `room_id=eq.${roomUuid}`,
      },
      (payload) => {
        try {
          const pingRow = payload?.new || payload?.record || null;
          if (!pingRow) return;
          applyPingStatsRow(pingRow);
          pushIncomingPing(pingRow);
        } catch (err) {
          console.error(err);
        }
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.info(`[Lingo Ping] Realtime subscribed for room ${roomUuid}`);
      } else if (status === "CHANNEL_ERROR") {
        console.error("[Lingo Ping] Realtime channel error.");
      } else if (status === "TIMED_OUT") {
        console.warn("[Lingo Ping] Realtime channel timed out.");
      }
    });

  remote.pingChannel = channel;
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
  remote.myUserId = String(user?.id || "").trim();
  const memberProfiles = await resolveRoomMemberProfiles(client, roomRow);

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

  remote.lastPingId = "";
  pingStore.set(null);
  await initPingStatsForToday(client, remote.roomUuid, remote.myUserId);
  const missedRows = await fetchMissedPingsSinceLastSeen(client, remote.roomUuid, remote.myUserId);
  await attachRoomStateChannel(client, remote.roomUuid);
  try {
    await attachPingChannel(client, remote.roomUuid);
  } catch (err) {
    console.warn("[Lingo Ping] Skip realtime ping channel:", err?.message || err);
  }

  setMeta({
    ready: true,
    loading: false,
    status: "synced",
    roomId: remote.roomCode,
    myUserId: String(user?.id || ""),
    ownerProfile: memberProfiles.ownerProfile,
    partnerProfile: memberProfiles.partnerProfile,
    error: "",
    source: "supabase-postgres",
  });

  syncPushSubscriptionForRoom(client, remote.roomUuid, remote.myUserId, {
    promptPermission: true,
  }).catch((err) => {
    console.warn("[Lingo Push] subscription sync failed:", err?.message || err);
  });

  if (Array.isArray(missedRows) && missedRows.length > 0) {
    const newest = missedRows[missedRows.length - 1];
    const newestId = String(newest?.id || "").trim();
    const eventId = newestId ? `missed:${newestId}` : `missed:${Date.now()}`;
    remote.lastPingId = eventId;
    pingStore.set({
      id: eventId,
      senderId: String(newest?.sender_id || "").trim(),
      senderName: resolveMemberNameByUserId(
        { ownerProfile: memberProfiles.ownerProfile, partnerProfile: memberProfiles.partnerProfile },
        newest?.sender_id,
      ),
      createdAt: newest?.created_at || new Date().toISOString(),
      receivedAt: Date.now(),
      missedCount: missedRows.length,
    });
  }
}

export async function sendPing(roomId = "", myUserId = "") {
  const client = remote.client || supabase;
  if (!client) throw new Error("Supabase ch\u01b0a s\u1eb5n s\u00e0ng.");

  const metaSnapshot = currentMeta();
  const warmRoomUuid = String(remote.roomUuid || "").trim();
  const warmUserId = String(myUserId || metaSnapshot?.myUserId || remote.myUserId || "").trim();
  if (warmRoomUuid && warmUserId) {
    syncPushSubscriptionForRoom(client, warmRoomUuid, warmUserId, {
      promptPermission: true,
    }).catch(() => {});
  }

  const targetRoomCode = sanitizeRoomCode(roomId || remote.roomCode || metaSnapshot.roomId || "");
  if (!targetRoomCode) throw new Error("Ch\u01b0a c\u00f3 ph\u00f2ng \u0111\u1ec3 g\u1eedi N\u00fat ch\u1ea1m.");

  let targetRoomUuid = String(remote.roomUuid || "").trim();
  if (!targetRoomUuid || targetRoomCode !== remote.roomCode) {
    const roomRow = await fetchRoomRowForCurrentMember(client, targetRoomCode);
    targetRoomUuid = String(roomRow?.id || "").trim();
  }
  if (!targetRoomUuid) throw new Error("Kh\u00f4ng t\u00ecm th\u1ea5y ph\u00f2ng d\u1eef li\u1ec7u \u0111\u1ec3 g\u1eedi N\u00fat ch\u1ea1m.");

  let senderId = String(myUserId || metaSnapshot.myUserId || "").trim();
  if (!senderId) {
    senderId = String((await getCurrentAuthUser(client).catch(() => null))?.id || "").trim();
  }
  if (!senderId) throw new Error("Vui l\u00f2ng \u0111\u0103ng nh\u1eadp tr\u01b0\u1edbc khi g\u1eedi N\u00fat ch\u1ea1m.");

  const createdAt = new Date().toISOString();
  const { error } = await client.from("lingo_pings").insert({
    room_id: targetRoomUuid,
    sender_id: senderId,
    created_at: createdAt,
  });
  if (error) {
    throw new Error(friendlySupabaseError(error, "Kh\u00f4ng th\u1ec3 g\u1eedi N\u00fat ch\u1ea1m."));
  }

  const senderName = resolveMemberNameByUserId(metaSnapshot, senderId);
  invokeSendPingPush(client, {
    roomId: targetRoomUuid,
    roomCode: targetRoomCode,
    senderId,
    senderName,
    createdAt,
  }).catch(() => {});

  return true;
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
      draft.ui = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      draft.settings.startDate = typeof input.startDate === "string" ? input.startDate : "";
      draft.couple.personA = normalizePerson(input.personA || draft.couple.personA, "a");
      draft.couple.personB = normalizePerson(input.personB || draft.couple.personB, "b");
      const nextMode = input?.ui?.authPanelMode;
      if (nextMode === "ultra_minimal" || nextMode === "standard") {
        draft.ui.authPanelMode = nextMode;
      }
      const nextFont = input?.ui?.systemFont;
      if (nextFont === "be_vietnam_pro" || nextFont === "paytone_one" || nextFont === "itim" || nextFont === "pangolin" || nextFont === "pacifico" || nextFont === "prata") {
        draft.ui.systemFont = nextFont;
      } else if (nextFont === "pacifico_prata") {
        draft.ui.systemFont = "prata";
      }
    });
  },
  saveStartDate(startDate) {
    return updateState((draft) => {
      draft.settings = draft.settings || {};
      draft.settings.startDate = typeof startDate === "string" ? startDate : "";
    });
  },
  setAuthPanelMode(mode) {
    return updateState((draft) => {
      draft.ui = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      if (mode === "standard" || mode === "ultra_minimal") {
        draft.ui.authPanelMode = mode;
      }
    });
  },
  setSystemFont(font) {
    return updateState((draft) => {
      draft.ui = draft.ui && typeof draft.ui === "object" ? draft.ui : {};
      if (font === "be_vietnam_pro" || font === "paytone_one" || font === "itim" || font === "pangolin" || font === "pacifico" || font === "prata") {
        draft.ui.systemFont = font;
      } else if (font === "pacifico_prata") {
        draft.ui.systemFont = "prata";
      }
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
  sendPing(roomId, myUserId) {
    return sendPing(roomId, myUserId);
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
      myUserId: "",
      ownerProfile: null,
      partnerProfile: null,
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
      const client = supabase;
      if (!client) throw new Error("Supabase chưa sẵn sàng.");
      remote.client = client;

      const roomCode = await resolveRoomCode(client);
      const finalRoomCode = sanitizeRoomCode(roomCode || "");
      remote.roomCode = finalRoomCode;

      if (!finalRoomCode) {
        remote.lastPingId = "";
        remote.myUserId = "";
        remote.seenPingIds = new Set();
        remote.lastSeenPingAtMs = 0;
        pingStore.set(null);
        pingStatsStore.set(createEmptyPingStats());
        setMeta({
          ready: true,
          loading: false,
          status: "draft",
          roomId: "",
          myUserId: "",
          ownerProfile: null,
          partnerProfile: null,
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
        myUserId: "",
        ownerProfile: null,
        partnerProfile: null,
        source: "supabase-postgres",
        error: friendlySupabaseError(err, "Không thể khởi tạo kết nối dữ liệu."),
      });
      remote.lastPingId = "";
      remote.myUserId = "";
      remote.seenPingIds = new Set();
      remote.lastSeenPingAtMs = 0;
      pingStore.set(null);
      pingStatsStore.set(createEmptyPingStats());
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
  if (remote.client && remote.pingChannel) {
    try {
      remote.client.removeChannel(remote.pingChannel);
    } catch (err) {
      console.warn(err);
    }
  }
  remote.channel = null;
  remote.pingChannel = null;
  remote.roomUuid = "";
  remote.roomCode = "";
  remote.lastPingId = "";
  remote.myUserId = "";
  remote.seenPingIds = new Set();
  remote.lastSeenPingAtMs = 0;
  pingStore.set(null);
  pingStatsStore.set(createEmptyPingStats());
  setMeta({
    roomId: "",
    myUserId: "",
    ownerProfile: null,
    partnerProfile: null,
  });
  remote.readyResolve = null;
  remote.inited = false;
  remote.initPromise = null;
}
