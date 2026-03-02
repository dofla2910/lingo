import {
  createPairRoom,
  joinPairRoom,
  mapRoomRowToDto,
  supabase,
} from "../supabaseClient.js";

export function createPairingSlice({
  getState,
  getProps,
  patch,
  normalizeCode,
  toErrorMessage,
  emitToast,
  hasValidProfile,
  openProfileModal,
  openCredentialModal,
  onOpenWizard,
  onRoomConnect,
} = {}) {
  function ensureClient() {
    if (!supabase) throw new Error("Supabase chưa sẵn sàng.");
    return supabase;
  }

  function roomUserPayload() {
    const state = getState();
    return {
      ...state.me,
      username: state.myProfile?.name || state.me?.username || "user",
      avatarUrl: state.myProfile?.avatarUrl || "",
    };
  }

  async function createPairCode(options = {}) {
    const state = getState();
    const props = getProps();
    if (state.pairBusy || state.authBusy) return null;

    if (!state.me) {
      if (options.auto) {
        patch({ infoText: "Đã lưu Wizard. Hãy đăng nhập để hệ thống tự tạo mã ghép cặp." });
        emitToast("Đăng nhập để tạo mã ghép cặp.");
        openCredentialModal({ mode: "signin", autoPair: true });
        return null;
      }
      patch({ errorText: "Vui lòng đăng nhập trước." });
      return null;
    }

    if (!props.hasStartDate) {
      patch({ errorText: "Hãy hoàn tất Wizard (ngày bắt đầu yêu) trước khi tạo mã ghép cặp." });
      onOpenWizard();
      return null;
    }

    if (!hasValidProfile()) {
      patch({ errorText: "Vui lòng cập nhật hồ sơ cá nhân trước khi tạo phòng." });
      openProfileModal({ required: true, keepMessages: true });
      return null;
    }

    patch({
      pairBusy: true,
      errorText: "",
      ...(options.keepInfo ? {} : { infoText: "" }),
    });

    try {
      const client = ensureClient();
      const row = await createPairRoom(roomUserPayload(), client);
      const current = getState();
      const nextRoom = mapRoomRowToDto(row, current.me?.id || "");
      if (!nextRoom?.code) throw new Error("Không nhận được mã ghép cặp.");

      const reused = !!current.room?.code && current.room.code === nextRoom.code;
      patch({
        room: nextRoom,
        joinCode: String(nextRoom.code).toUpperCase(),
        providerPickerOpen: false,
        pendingAutoPairAfterAuth: false,
        autoPairRequestedFromQuery: false,
        ...(options.auto ? { infoText: `Mã ghép cặp đã sẵn sàng: ${nextRoom.code}. Gửi cho người kia để tham gia.` } : {}),
      });

      emitToast(reused ? `Dùng lại mã phòng: ${nextRoom.code}` : `Đã tạo mã ghép cặp: ${nextRoom.code}`);
      onRoomConnect({
        roomId: nextRoom.code,
        code: nextRoom.code,
        room: nextRoom,
        source: reused ? "reuse" : "create",
      });
      return nextRoom;
    } catch (err) {
      patch({ errorText: toErrorMessage(err, "Không thể tạo mã ghép cặp.") });
      return null;
    } finally {
      patch({ pairBusy: false });
    }
  }

  async function joinPairCode() {
    const state = getState();
    const code = normalizeCode(state.joinCode);
    patch({ joinCode: code });

    if (code.length !== 6) {
      patch({ errorText: "Mã ghép cặp phải gồm 6 ký tự." });
      return;
    }
    if (!state.me) {
      patch({ errorText: "Vui lòng đăng nhập trước." });
      return;
    }
    if (!hasValidProfile()) {
      patch({ errorText: "Vui lòng cập nhật hồ sơ cá nhân trước khi tham gia phòng." });
      openProfileModal({ required: true, keepMessages: true });
      return;
    }

    patch({
      pairBusy: true,
      errorText: "",
      infoText: "",
    });

    try {
      const client = ensureClient();
      const row = await joinPairRoom(code, roomUserPayload(), client);
      const nextRoom = mapRoomRowToDto(row, getState().me?.id || "");
      if (!nextRoom) throw new Error("Không thể nhận thông tin phòng sau khi ghép cặp.");

      patch({
        room: nextRoom,
        pendingJoinCodeAfterAuth: "",
        pendingAutoPairAfterAuth: false,
        autoPairRequestedFromQuery: false,
        ...(nextRoom.isOwner ? { infoText: `Bạn đang dùng chính mã phòng ${code}. Hãy gửi mã này cho người kia.` } : {}),
      });

      if (!nextRoom.isOwner) emitToast(`Đã ghép cặp vào phòng ${code}.`);
      onRoomConnect({
        roomId: nextRoom.code,
        code: nextRoom.code,
        room: nextRoom,
        source: nextRoom.isOwner ? "self-room" : "join",
      });
    } catch (err) {
      patch({ errorText: toErrorMessage(err, "Không thể ghép cặp.") });
    } finally {
      patch({ pairBusy: false });
    }
  }

  async function copyRoomLink() {
    const code = getState().room?.code || "";
    if (!code || typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.set("room", code);
    url.searchParams.delete("code");
    const text = url.toString();

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard API not available");
      }
      emitToast("Đã copy link phòng để gửi cho người kia.");
    } catch {
      patch({ infoText: `Link phòng: ${text}` });
    }
  }

  function reconnectCurrentRoom() {
    const state = getState();
    const props = getProps();
    const roomId = state.room?.code || props.currentRoomId || "";
    if (!roomId) return;
    onRoomConnect({
      roomId,
      code: roomId,
      room: state.room,
      source: "manual",
    });
  }

  return {
    createPairCode,
    joinPairCode,
    copyRoomLink,
    reconnectCurrentRoom,
  };
}
