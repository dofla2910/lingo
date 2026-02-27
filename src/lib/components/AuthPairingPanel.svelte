<script>
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import {
    createPairRoom,
    getCurrentAuthUser,
    getEnabledAuthProviders,
    getMyPairRoom,
    getMyUserProfile,
    getSupabaseClient,
    getSupabaseConfigError,
    isSchemaMissingError,
    isSupabaseConfigured,
    joinPairRoom,
    mapRoomRowToDto,
    sanitizeRoomCode,
    sanitizeUsername,
    signInWithUsernamePassword,
    signInWithProvider,
    signUpWithUsernamePassword,
    signOutAuth,
    upsertMyUserProfile,
  } from "../lingo/supabaseClient.js";
  import { fallbackFlamingoAvatar, parseDate, resizeAvatarFile } from "../lingo/utils.js";

  export let currentRoomId = "";
  export let syncStatus = "connecting";
  export let hasStartDate = false;
  export let ultraMinimal = false;
  export let open = false;

  const dispatch = createEventDispatcher();
  const fallbackAvatar = fallbackFlamingoAvatar(160);

  let loading = true;
  let authBusy = false;
  let pairBusy = false;
  let me = null;
  let room = null;
  let providers = [];
  let authConfigured = false;
  let joinCode = "";
  let errorText = "";
  let infoText = "";
  let providerPickerOpen = false;
  let providerPickerReason = "";
  let pendingAutoPairAfterAuth = false;
  let autoPairRequestedFromQuery = false;
  let authSubscription = null;
  let detailsExpanded = false;
  let credentialModalOpen = false;
  let credentialMode = "signin";
  let loginUsername = "";
  let loginPassword = "";
  let loginPasswordConfirm = "";
  let myProfile = null;
  let profileModalOpen = false;
  let profileBusy = false;
  let profilePromptedForUserId = "";
  let profileDraft = {
    name: "",
    birthday: "",
    gender: "khong_tiet_lo",
    avatarUrlInput: "",
    uploadedAvatarData: "",
    useDefault: true,
    existingAvatarUrl: "",
  };

  const SHOW_PROVIDER_LOGIN = false;

  function emitToast(message) {
    if (!message) return;
    dispatch("toast", message);
  }

  function normalizeCode(value) {
    return sanitizeRoomCode(value);
  }

  function providerIcon(id) {
    const k = String(id || "").toLowerCase();
    if (k === "email" || k === "supabase") return "👤";
    if (k === "instagram") return "📸";
    if (k === "facebook") return "📘";
    if (k === "google") return "🔎";
    if (k === "github") return "🐙";
    if (k === "discord") return "🎮";
    if (k === "apple") return "🍎";
    return "🔐";
  }

  function providerName(id, fallback = "") {
    const k = String(id || "").toLowerCase();
    if (fallback) return fallback;
    if (k === "email" || k === "supabase") return "Tài khoản";
    if (k === "instagram") return "Instagram";
    if (k === "facebook") return "Facebook";
    if (k === "google") return "Google";
    if (k === "github") return "GitHub";
    if (k === "discord") return "Discord";
    if (k === "apple") return "Apple";
    return id || "OAuth";
  }

  function providerHint(id) {
    const k = String(id || "").toLowerCase();
    if (k === "instagram") return "Phù hợp nếu cả hai thường dùng Instagram. Có thể cần bật sẵn trong phần cài đặt đăng nhập.";
    if (k === "facebook") return "Dễ dùng cho đa số người dùng, thuận tiện chia sẻ mã ghép cặp.";
    if (k === "google") return "Đăng nhập nhanh, thường ổn định với callback URL.";
    if (k === "github") return "Tiện cho tài khoản kỹ thuật / dev.";
    if (k === "discord") return "Nhanh cho cặp đôi dùng Discord.";
    if (k === "apple") return "Phù hợp hệ sinh thái Apple, cần cấu hình provider trước.";
    return "Đăng nhập để tạo hoặc tham gia phòng cặp đôi.";
  }

  function providerAccent(id) {
    const k = String(id || "").toLowerCase();
    if (k === "instagram") return "from-pink-400/25 to-orange-300/25";
    if (k === "facebook") return "from-blue-400/25 to-sky-300/25";
    if (k === "google") return "from-emerald-300/20 to-rose-300/20";
    if (k === "github") return "from-slate-400/20 to-zinc-300/20";
    if (k === "discord") return "from-indigo-400/25 to-violet-300/25";
    if (k === "apple") return "from-zinc-300/20 to-slate-300/20";
    return "from-pink-300/20 to-rose-200/20";
  }

  function toErrorMessage(err, fallback = "Không thể thực hiện thao tác.") {
    const msg = String(err?.message || err || fallback);
    const lower = msg.toLowerCase();

    if (isSchemaMissingError?.(err)) {
      return "Ứng dụng chưa sẵn sàng dữ liệu. Vui lòng thử lại sau.";
    }
    if (msg.includes("UNAUTHENTICATED")) return "Vui lòng đăng nhập trước.";
    if (msg.includes("INVALID_CODE")) return "Mã ghép cặp không hợp lệ (cần đúng 6 ký tự).";
    if (msg.includes("CODE_NOT_FOUND_OR_EXPIRED")) return "Mã không tồn tại hoặc đã hết hạn.";
    if (msg.includes("ROOM_ALREADY_HAS_2_PEOPLE")) return "Phòng này đã đủ 2 người.";
    if (lower.includes("row-level security") || lower.includes("permission denied")) {
      return "Không thể truy cập dữ liệu phòng. Hãy đăng nhập lại hoặc thử lại sau.";
    }
    if (lower.includes("failed to fetch") || lower.includes("network")) {
      return "Không thể kết nối dữ liệu. Hãy kiểm tra mạng.";
    }
    if (lower.includes("supabase chưa cấu hình") || lower.includes("vite_supabase_")) {
      return msg;
    }
    return msg || fallback;
  }

  function clearMessages() {
    errorText = "";
    infoText = "";
  }

  function profileFromRow(row, fallbackUser = null) {
    const fallbackName = sanitizeUsername(fallbackUser?.username || "") || "user";
    return {
      name: String(row?.name || fallbackName).trim(),
      birthday: String(row?.birthday || "").trim(),
      gender: ["nam", "nu", "khac", "khong_tiet_lo"].includes(row?.gender) ? row.gender : "khong_tiet_lo",
      avatarUrl: String(row?.avatarUrl || "").trim(),
    };
  }

  function hydrateProfileDraft(profile) {
    profileDraft = {
      name: String(profile?.name || "").trim(),
      birthday: String(profile?.birthday || "").trim(),
      gender: ["nam", "nu", "khac", "khong_tiet_lo"].includes(profile?.gender) ? profile.gender : "khong_tiet_lo",
      avatarUrlInput: String(profile?.avatarUrl || "").trim(),
      uploadedAvatarData: "",
      useDefault: !String(profile?.avatarUrl || "").trim(),
      existingAvatarUrl: String(profile?.avatarUrl || "").trim(),
    };
  }

  function openProfileModal(options = {}) {
    if (!me) return;
    if (!options.keepMessages) clearMessages();
    const base = myProfile || profileFromRow(null, me);
    hydrateProfileDraft(base);
    profileModalOpen = true;
    if (options.required) {
      infoText = "Vui lòng hoàn tất hồ sơ trước khi tạo hoặc tham gia phòng.";
    }
  }

  function closeProfileModal() {
    if (profileBusy) return;
    profileModalOpen = false;
  }

  function composeProfilePayload() {
    const name = String(profileDraft.name || "").trim();
    const birthday = String(profileDraft.birthday || "").trim();
    const gender = profileDraft.gender || "khong_tiet_lo";
    const avatarUrl = profileDraft.useDefault
      ? ""
      : String(profileDraft.uploadedAvatarData || profileDraft.avatarUrlInput || profileDraft.existingAvatarUrl || "").trim();

    if (!name) throw new Error("Vui lòng nhập tên hiển thị.");
    if (!birthday || !parseDate(birthday)) throw new Error("Ngày sinh không hợp lệ.");

    return {
      name,
      birthday,
      gender,
      avatarUrl,
    };
  }

  async function onProfileAvatarFile(file) {
    if (!file) return;
    try {
      const data = await resizeAvatarFile(file, 320);
      profileDraft.uploadedAvatarData = data || "";
      profileDraft.useDefault = false;
    } catch (err) {
      errorText = err?.message || "Không thể xử lý ảnh.";
    }
  }

  function onProfileImageError(event) {
    if (event?.currentTarget) event.currentTarget.src = fallbackAvatar;
  }

  async function saveMyProfile() {
    if (!me || profileBusy) return;
    profileBusy = true;
    errorText = "";
    try {
      const payload = composeProfilePayload();
      const client = getSupabaseClient();
      const row = await upsertMyUserProfile(payload, client);
      myProfile = profileFromRow(row, me);
      profileModalOpen = false;
      emitToast("Đã lưu hồ sơ cá nhân.");
      if (pendingAutoPairAfterAuth && hasStartDate && !room) {
        await createPairCode({ auto: true, keepInfo: false });
      } else if (room?.code) {
        reconnectCurrentRoom();
      }
    } catch (err) {
      errorText = toErrorMessage(err, "Không thể lưu hồ sơ.");
    } finally {
      profileBusy = false;
    }
  }

  function hasValidProfile() {
    return !!(myProfile?.name && myProfile?.birthday && parseDate(myProfile.birthday));
  }

  async function refreshAuthPairState() {
    loading = true;
    errorText = "";

    providers = getEnabledAuthProviders();
    authConfigured = isSupabaseConfigured();
    const cfgErr = getSupabaseConfigError();
    if (cfgErr) {
      me = null;
      room = null;
      if (!joinCode && currentRoomId) joinCode = normalizeCode(currentRoomId);
      errorText = "Tính năng đăng nhập tạm thời chưa sẵn sàng.";
      loading = false;
      return;
    }

    try {
      const client = getSupabaseClient();
      me = await getCurrentAuthUser(client);

      if (me) {
        const profileRow = await getMyUserProfile(client).catch(() => null);
        myProfile = profileFromRow(profileRow, me);
        const roomRow = await getMyPairRoom(client).catch((err) => {
          if (String(err?.message || "").includes("0 rows")) return null;
          throw err;
        });
        room = mapRoomRowToDto(roomRow, me.id);
      } else {
        room = null;
        myProfile = null;
      }

      if (room?.code) {
        joinCode = String(room.code).toUpperCase();
      } else if (!joinCode && currentRoomId) {
        joinCode = normalizeCode(currentRoomId);
      }
    } catch (err) {
      errorText = toErrorMessage(err, "Không thể tải trạng thái đăng nhập.");
    } finally {
      loading = false;
    }
  }

  function openProviderPicker(options = {}) {
    if (!SHOW_PROVIDER_LOGIN) {
      openCredentialModal({
        mode: "signin",
        autoPair: !!options.autoPair,
      });
      return;
    }
    const cfgErr = getSupabaseConfigError();
    if (cfgErr) {
      errorText = "Tính năng đăng nhập tạm thời chưa sẵn sàng.";
      return;
    }
    if (!providers.length) {
      errorText = "Hiện chưa có cách đăng nhập nào khả dụng.";
      return;
    }
    providerPickerReason = String(options.reason || "");
    if (options.autoPair) pendingAutoPairAfterAuth = true;
    providerPickerOpen = true;
  }

  function closeProviderPicker() {
    if (authBusy) return;
    providerPickerOpen = false;
  }

  function openCredentialModal(options = {}) {
    const cfgErr = getSupabaseConfigError();
    if (cfgErr) {
      errorText = "Tính năng đăng nhập tạm thời chưa sẵn sàng.";
      return;
    }
    providerPickerOpen = false;
    if (!options.keepMessages) {
      clearMessages();
    }
    credentialMode = options.mode === "signup" ? "signup" : "signin";
    credentialModalOpen = true;
    if (options.autoPair) pendingAutoPairAfterAuth = true;
    if (options.clearPassword !== false) {
      loginPassword = "";
      loginPasswordConfirm = "";
    }
    if (options.focusUsername && !loginUsername) {
      loginUsername = "";
    }
  }

  function closeCredentialModal() {
    if (authBusy) return;
    credentialModalOpen = false;
  }

  function resetCredentialInputs() {
    loginPassword = "";
    loginPasswordConfirm = "";
  }

  async function submitCredentialAuth() {
    if (authBusy) return;
    clearMessages();

    const username = sanitizeUsername(loginUsername);
    const password = String(loginPassword || "");
    const confirm = String(loginPasswordConfirm || "");

    if (!username) {
      errorText = "Vui lòng nhập tên đăng nhập (chỉ gồm chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang).";
      return;
    }
    if (password.length < 6) {
      errorText = "Mật khẩu cần ít nhất 6 ký tự.";
      return;
    }
    if (credentialMode === "signup" && password !== confirm) {
      errorText = "Mật khẩu xác nhận chưa khớp.";
      return;
    }

    authBusy = true;
    try {
      const client = getSupabaseClient();

      if (credentialMode === "signup") {
        const data = await signUpWithUsernamePassword({ username, password }, client);
        if (data?.needsEmailConfirmation) {
          infoText =
            "Tài khoản đã được tạo nhưng Supabase đang bật xác nhận email. Với chế độ đăng nhập tên đăng nhập, hãy tắt Email Confirmations trong Supabase Auth rồi thử lại.";
        } else {
          infoText = "Đã tạo tài khoản và đăng nhập thành công.";
          emitToast("Đã tạo tài khoản.");
        }
      } else {
        await signInWithUsernamePassword({ username, password }, client);
        infoText = "Đăng nhập thành công.";
        emitToast("Đăng nhập thành công.");
      }

      loginUsername = username;
      resetCredentialInputs();
      credentialModalOpen = false;
      await refreshAuthPairState();

      if (!hasValidProfile()) {
        openProfileModal({ required: true, keepMessages: true });
      } else if (pendingAutoPairAfterAuth && hasStartDate && !room) {
        await createPairCode({ auto: true, keepInfo: false });
      }
    } catch (err) {
      const msg = String(err?.message || "");
      const lower = msg.toLowerCase();
      if (
        lower.includes("invalid login credentials") ||
        lower.includes("email not confirmed") ||
        lower.includes("invalid_credentials")
      ) {
        errorText = "Tên đăng nhập hoặc mật khẩu chưa đúng.";
      } else if (lower.includes("user already registered")) {
        errorText = "Tên đăng nhập này đã tồn tại.";
      } else if (lower.includes("password should be at least")) {
        errorText = "Mật khẩu cần ít nhất 6 ký tự.";
      } else {
        errorText = toErrorMessage(err, "Không thể đăng nhập.");
      }
    } finally {
      authBusy = false;
    }
  }

  function requestClose() {
    if (authBusy && (providerPickerOpen || credentialModalOpen)) return;
    providerPickerOpen = false;
    credentialModalOpen = false;
    dispatch("close");
  }

  function handleKeydown(event) {
    if (event.key !== "Escape") return;
    if (credentialModalOpen) {
      event.preventDefault();
      closeCredentialModal();
      return;
    }
    if (providerPickerOpen) {
      event.preventDefault();
      closeProviderPicker();
      return;
    }
    if (open) {
      event.preventDefault();
      requestClose();
    }
  }

  function normalizeOAuthReturnUrl() {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    const hash = String(url.hash || "");
    let changed = false;

    // Fix malformed callback URLs like:
    // #error=access_denied...&sb=#access_token=...
    // This happens when an old hash is preserved in redirectTo.
    const nestedTokenHashIndex = hash.indexOf("#access_token=");
    if (nestedTokenHashIndex > 0) {
      url.hash = hash.slice(nestedTokenHashIndex);
      url.searchParams.delete("error");
      url.searchParams.delete("error_description");
      url.searchParams.delete("auth_error");
      changed = true;
    }

    if (changed) history.replaceState({}, "", url);
    return changed;
  }

  function consumeAuthQueryFlags() {
    if (typeof window === "undefined") return;
    normalizeOAuthReturnUrl();

    const url = new URL(window.location.href);
    let changed = false;
    const hasTokenHash = /(?:^#|&)access_token=/.test(String(url.hash || ""));

    const authOk = url.searchParams.get("auth");
    const authErr = url.searchParams.get("auth_error") || url.searchParams.get("error");
    const autoPair = url.searchParams.get("autoPair");

    if (autoPair === "create") {
      autoPairRequestedFromQuery = true;
      pendingAutoPairAfterAuth = true;
      url.searchParams.delete("autoPair");
      changed = true;
    }

    if (authOk) {
      emitToast("Đăng nhập thành công.");
      url.searchParams.delete("auth");
      url.searchParams.delete("error");
      url.searchParams.delete("error_description");
      url.searchParams.delete("auth_error");
      changed = true;
    }

    if (authErr && !hasTokenHash) {
      errorText = `Đăng nhập lỗi: ${authErr}`;
      url.searchParams.delete("auth_error");
      url.searchParams.delete("error");
      url.searchParams.delete("error_description");
      changed = true;
    } else if (hasTokenHash && url.searchParams.has("error_description")) {
      // Remove stale OAuth error query params from previous attempts.
      url.searchParams.delete("error");
      url.searchParams.delete("auth_error");
      url.searchParams.delete("error_description");
      changed = true;
    }

    if (changed) history.replaceState({}, "", url);
  }

  function buildAuthRedirectUrl() {
    const callbackUrl = new URL(window.location.href);
    callbackUrl.hash = "";
    callbackUrl.searchParams.delete("error");
    callbackUrl.searchParams.delete("error_description");
    callbackUrl.searchParams.delete("auth_error");
    callbackUrl.searchParams.set("auth", "oauth_ok");
    if (pendingAutoPairAfterAuth) {
      callbackUrl.searchParams.set("autoPair", "create");
    }
    return callbackUrl.toString();
  }

  async function startAuthLogin(providerId) {
    const pid = String(providerId || "").trim();
    if (!pid) return;

    authBusy = true;
    errorText = "";

    try {
      const client = getSupabaseClient();
      const redirectTo = buildAuthRedirectUrl();
      const data = await signInWithProvider(pid, { redirectTo }, client);
      providerPickerOpen = false;

      if (data?.url && typeof window !== "undefined") {
        window.location.assign(data.url);
        return;
      }

      authBusy = false;
      infoText = "Đã gửi yêu cầu đăng nhập. Nếu chưa chuyển trang, hãy kiểm tra cấu hình provider.";
    } catch (err) {
      authBusy = false;
      errorText = toErrorMessage(err, "Không thể bắt đầu đăng nhập.");
    }
  }

  async function logout() {
    authBusy = true;
    clearMessages();
    try {
      const client = getSupabaseClient();
      await signOutAuth(client);
      me = null;
      room = null;
      myProfile = null;
      joinCode = "";
      pendingAutoPairAfterAuth = false;
      autoPairRequestedFromQuery = false;
      profileModalOpen = false;
      profilePromptedForUserId = "";
      infoText = "Đã đăng xuất.";
      emitToast("Đã đăng xuất.");
      dispatch("refreshroom", { clearRoomQuery: true });
    } catch (err) {
      errorText = toErrorMessage(err, "Không thể đăng xuất.");
    } finally {
      authBusy = false;
    }
  }

  function roomUserPayload() {
    return {
      ...me,
      username: myProfile?.name || me?.username || "user",
      avatarUrl: myProfile?.avatarUrl || "",
    };
  }

  async function createPairCode(options = {}) {
    if (pairBusy || authBusy) return null;

    if (!me) {
      if (options.auto) {
        infoText = "Đã lưu Wizard. Hãy đăng nhập để hệ thống tự tạo mã ghép cặp.";
        emitToast("Đăng nhập để tạo mã ghép cặp.");
        openCredentialModal({ mode: "signin", autoPair: true });
        return null;
      }
      errorText = "Vui lòng đăng nhập trước.";
      return null;
    }

    if (!hasStartDate) {
      errorText = "Hãy hoàn tất Wizard (ngày bắt đầu yêu) trước khi tạo mã ghép cặp.";
      dispatch("openwizard");
      return null;
    }
    if (!hasValidProfile()) {
      errorText = "Vui lòng cập nhật hồ sơ cá nhân trước khi tạo phòng.";
      openProfileModal({ required: true, keepMessages: true });
      return null;
    }

    pairBusy = true;
    errorText = "";
    if (!options.keepInfo) infoText = "";

    try {
      const client = getSupabaseClient();
      const row = await createPairRoom(roomUserPayload(), client);
      const nextRoom = mapRoomRowToDto(row, me.id);
      if (!nextRoom?.code) throw new Error("Không nhận được mã ghép cặp.");

      const reused = !!room?.code && room.code === nextRoom.code;
      room = nextRoom;
      joinCode = String(nextRoom.code).toUpperCase();
      providerPickerOpen = false;
      pendingAutoPairAfterAuth = false;
      autoPairRequestedFromQuery = false;

      if (options.auto) {
        infoText = `Mã ghép cặp đã sẵn sàng: ${joinCode}. Gửi cho người kia để tham gia.`;
      }

      emitToast(reused ? `Dùng lại mã phòng: ${joinCode}` : `Đã tạo mã ghép cặp: ${joinCode}`);
      dispatch("roomconnect", {
        roomId: nextRoom.code,
        code: nextRoom.code,
        room: nextRoom,
        source: reused ? "reuse" : "create",
      });
      return nextRoom;
    } catch (err) {
      errorText = toErrorMessage(err, "Không thể tạo mã ghép cặp.");
      return null;
    } finally {
      pairBusy = false;
    }
  }

  async function joinPairCode() {
    const code = normalizeCode(joinCode);
    joinCode = code;

    if (code.length !== 6) {
      errorText = "Mã ghép cặp phải gồm 6 ký tự.";
      return;
    }
    if (!me) {
      errorText = "Vui lòng đăng nhập trước.";
      return;
    }
    if (!hasValidProfile()) {
      errorText = "Vui lòng cập nhật hồ sơ cá nhân trước khi tham gia phòng.";
      openProfileModal({ required: true, keepMessages: true });
      return;
    }

    pairBusy = true;
    clearMessages();

    try {
      const client = getSupabaseClient();
      const row = await joinPairRoom(code, roomUserPayload(), client);
      const nextRoom = mapRoomRowToDto(row, me.id);
      if (!nextRoom) throw new Error("Không thể nhận thông tin phòng sau khi ghép cặp.");

      room = nextRoom;
      pendingAutoPairAfterAuth = false;
      autoPairRequestedFromQuery = false;

      if (nextRoom.isOwner) {
        infoText = `Bạn đang dùng chính mã phòng ${code}. Hãy gửi mã này cho người kia.`;
      } else {
        emitToast(`Đã ghép cặp vào phòng ${code}.`);
      }

      dispatch("roomconnect", {
        roomId: nextRoom.code,
        code: nextRoom.code,
        room: nextRoom,
        source: nextRoom.isOwner ? "self-room" : "join",
      });
    } catch (err) {
      errorText = toErrorMessage(err, "Không thể ghép cặp.");
    } finally {
      pairBusy = false;
    }
  }

  async function copyRoomLink() {
    const code = room?.code || "";
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
      infoText = `Link phòng: ${text}`;
    }
  }

  function reconnectCurrentRoom() {
    const roomId = room?.code || currentRoomId || "";
    if (!roomId) return;
    dispatch("roomconnect", {
      roomId,
      code: roomId,
      room,
      source: "manual",
    });
  }

  export async function handleWizardCompletedAutoPair() {
    errorText = "";
    await refreshAuthPairState();

    if (room?.code) {
      if ((room.roomId || room.code) !== currentRoomId) {
        dispatch("roomconnect", {
          roomId: room.roomId || room.code,
          code: room.code,
          room,
          source: "wizard-existing-room",
        });
      }
      infoText = `Bạn đã có mã phòng ${room.code}. Gửi cho người kia để ghép cặp.`;
      emitToast(`Mã phòng hiện tại: ${room.code}`);
      return;
    }

    if (!me) {
      infoText = "Đã lưu Wizard. Đăng nhập bằng tên đăng nhập và mật khẩu để hệ thống tự tạo mã ghép cặp.";
      emitToast("Đăng nhập để tạo mã ghép cặp.");
      openCredentialModal({ mode: "signin", autoPair: true });
      return;
    }
    if (!hasValidProfile()) {
      infoText = "Hãy cập nhật hồ sơ cá nhân trước khi tạo mã ghép cặp.";
      openProfileModal({ required: true, keepMessages: true });
      return;
    }

    if (!hasStartDate) return;
    await createPairCode({ auto: true, keepInfo: false });
  }

  function setupAuthStateListener() {
    try {
      const client = getSupabaseClient();
      const result = client.auth.onAuthStateChange((_event, _session) => {
        refreshAuthPairState().catch((err) => {
          console.error(err);
          errorText = toErrorMessage(err, "Không thể cập nhật trạng thái đăng nhập.");
        });
      });
      authSubscription = result?.data?.subscription || null;
    } catch {
      authSubscription = null;
    }
  }

  onMount(async () => {
    consumeAuthQueryFlags();
    await refreshAuthPairState();
    setupAuthStateListener();

    if (autoPairRequestedFromQuery && me && hasStartDate && !room) {
      await createPairCode({ auto: true, keepInfo: false });
    } else if (autoPairRequestedFromQuery && !me) {
      infoText = "Đăng nhập chưa hoàn tất. Vui lòng nhập lại tên đăng nhập và mật khẩu.";
      openCredentialModal({ mode: "signin", autoPair: true });
    }
  });

  onDestroy(() => {
    try {
      authSubscription?.unsubscribe?.();
    } catch {
      // noop
    }
  });

  $: effectiveRoomCode = room?.code || currentRoomId || "";
  $: needsConnect = !!effectiveRoomCode && currentRoomId !== effectiveRoomCode;
  $: providerSummary = providers.length ? providers.map((p) => providerName(p.id, p.name)).join(", ") : "";
  $: canShowProviderTrigger = authConfigured && providers.length > 0 && !me;
  $: canUsePasswordLogin = authConfigured && !me;
  $: displayAccountName = myProfile?.name || me?.username || "user";
  $: profileAvatarPreview = profileDraft.useDefault
    ? fallbackAvatar
    : (profileDraft.uploadedAvatarData || profileDraft.avatarUrlInput?.trim() || profileDraft.existingAvatarUrl || fallbackAvatar);
  $: if (!open || !me?.id || hasValidProfile()) {
    profilePromptedForUserId = "";
  }
  $: if (
    open &&
    me?.id &&
    !hasValidProfile() &&
    !profileModalOpen &&
    !authBusy &&
    !profileBusy &&
    profilePromptedForUserId !== me.id
  ) {
    profilePromptedForUserId = me.id;
    openProfileModal({ required: true, keepMessages: true });
  }
  $: if (!open && providerPickerOpen) providerPickerOpen = false;
  $: if (!open && credentialModalOpen) credentialModalOpen = false;
  $: if (!open && profileModalOpen) profileModalOpen = false;
</script>

<svelte:window on:keydown={handleKeydown} />

<div class={`modal ${open ? "open" : ""}`} aria-hidden={!open} on:click|self={requestClose}>
  <div
    class="modal-card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="pairingPanelTitle"
    tabindex="-1"
    style="max-width: 74rem;"
  >
    <div class="flex items-center justify-between border-b border-pink-100/70 px-4 py-3 sm:px-5">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Kết nối cặp đôi</p>
        <h3 id="pairingPanelTitle" class="text-lg font-bold text-[color:var(--ink)]">Đăng nhập & ghép cặp</h3>
      </div>
      <button type="button" class="btn btn-soft text-sm" on:click={requestClose}>Đóng</button>
    </div>
    <div class="max-h-[78vh] overflow-y-auto px-4 py-4 sm:px-5">
      <section class="p-0">
  {#if !ultraMinimal}
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.18em] text-pink-500/80">Kết nối cặp đôi</p>
        <h2 class="mt-1 text-lg sm:text-xl font-extrabold text-[color:var(--ink)]">Đăng nhập & ghép cặp</h2>
        <p class="mt-1 text-sm text-[color:var(--ink2)]">Tạo mã 6 ký tự hoặc nhập mã người kia gửi để dùng chung một phòng.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-soft text-sm w-full sm:w-auto" type="button" on:click={refreshAuthPairState} disabled={loading || authBusy || pairBusy}>
          {loading ? "Đang tải..." : "Làm mới"}
        </button>
        <button
          class={`btn text-sm w-full sm:w-auto ${me ? "btn-soft" : "btn-primary"}`}
          type="button"
          on:click={me ? logout : () => openCredentialModal({ mode: "signin" })}
          disabled={authBusy || pairBusy || (!me && !canUsePasswordLogin)}
        >
          {#if me}
            {authBusy ? "Đang thoát..." : "Đăng xuất"}
          {:else}
            {authBusy ? "Đang chuyển..." : "Đăng nhập"}
          {/if}
        </button>
      </div>
    </div>
  {/if}
  {#if ultraMinimal}
    <div class="mt-4 rounded-2xl border border-white/70 bg-white/65 p-3 sm:p-4">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
        <div class="min-w-0 xl:flex-1">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="pill">
              {#if loading}
                Đang kiểm tra
              {:else if me}
                {displayAccountName}
              {:else}
                Chưa đăng nhập
              {/if}
            </span>
            {#if me}
              <span class="pill">{providerName(me.provider)}</span>
            {/if}
            <span class="pill">
              {syncStatus === "synced"
                ? "Đã kết nối phòng"
                : syncStatus === "saving"
                  ? "Đang lưu"
                  : syncStatus === "error"
                    ? "Lỗi kết nối"
                    : syncStatus === "draft"
                      ? "Chưa ghép phòng"
                      : "Đang kiểm tra"}
            </span>
            {#if room}
              <span class="pill">Phòng {room.code}</span>
            {/if}
          </div>
          <p class="mt-2 text-sm text-[color:var(--ink2)] truncate">
            {#if room}
              {room.status === "paired"
                ? "Hai bạn đã ghép cặp và có thể dùng chung dữ liệu."
                : `Phòng ${room.code} đang chờ người kia tham gia.`}
            {:else}
              Nhập mã 6 ký tự hoặc tạo mã mới để bắt đầu dùng chung một phòng.
            {/if}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button class="btn btn-soft text-sm" type="button" on:click={refreshAuthPairState} disabled={loading || authBusy || pairBusy}>
              {loading ? "Đang tải..." : "Làm mới"}
            </button>
            <button
              class={`btn text-sm ${me ? "btn-soft" : "btn-primary"}`}
              type="button"
              on:click={me ? logout : () => openCredentialModal({ mode: "signin" })}
              disabled={authBusy || pairBusy || (!me && !canUsePasswordLogin)}
            >
              {#if me}
                {authBusy ? "Đang thoát..." : "Đăng xuất"}
              {:else}
                {authBusy ? "Đang chuyển..." : "Đăng nhập"}
              {/if}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center xl:flex-nowrap xl:min-w-[34rem]">
          <input
            id="join_code"
            class="field h-11 min-w-0 flex-1 text-sm uppercase tracking-[.2em] text-center xl:max-w-[10rem]"
            type="text"
            placeholder="ABC123"
            maxlength="6"
            bind:value={joinCode}
            on:input={(e) => (joinCode = normalizeCode(e.currentTarget.value))}
            disabled={pairBusy || authBusy}
            aria-label="Mã ghép cặp 6 ký tự"
          />
          <button class="btn btn-soft text-sm w-full sm:w-auto whitespace-nowrap" type="button" on:click={joinPairCode} disabled={pairBusy || authBusy || !me}>
            {pairBusy ? "Đang xử lý..." : "Tham gia"}
          </button>
          <button class="btn btn-primary text-sm w-full sm:w-auto whitespace-nowrap" type="button" on:click={() => createPairCode()} disabled={pairBusy || authBusy || !me}>
            {pairBusy ? "Đang tạo..." : "Tạo mã"}
          </button>
          <button class="btn btn-soft text-sm w-full sm:w-auto whitespace-nowrap" type="button" on:click={() => (detailsExpanded = !detailsExpanded)}>
            {detailsExpanded ? "Thu gọn" : "Xem thêm"}
          </button>
        </div>
      </div>

      <div class="mt-2 flex flex-wrap gap-2">
        {#if room}
          <button class="btn btn-soft text-sm" type="button" on:click={copyRoomLink} disabled={pairBusy || authBusy}>Copy link phòng</button>
          {#if needsConnect}
            <button class="btn btn-soft text-sm" type="button" on:click={reconnectCurrentRoom} disabled={pairBusy || authBusy}>
              Kết nối lại
            </button>
          {/if}
        {/if}
        {#if !hasStartDate}
          <button class="btn btn-soft text-sm" type="button" on:click={() => dispatch("openwizard")}>Wizard</button>
          <button class="btn btn-soft text-sm" type="button" on:click={() => dispatch("openimport")}>Nhập JSON</button>
        {/if}
      </div>

      {#if detailsExpanded}
        <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="rounded-xl border border-white/70 bg-white/70 p-3">
            <p class="text-xs font-semibold uppercase tracking-[.12em] text-pink-500/80">Tài khoản</p>
            {#if me}
              <div class="mt-2 flex items-center gap-2">
                <div class="h-9 w-9 rounded-lg bg-white border border-white/80 flex items-center justify-center text-base shrink-0">
                  {providerIcon(me.provider)}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-[color:var(--ink)] truncate">{displayAccountName}</p>
                  <p class="text-xs text-[color:var(--ink2)]">{providerName(me.provider)}</p>
                </div>
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  class="btn btn-soft text-sm"
                  type="button"
                  on:click={() => openCredentialModal({ mode: "signin" })}
                  disabled={authBusy || pairBusy}
                >
                  Đổi tài khoản
                </button>
                <button class="btn btn-soft text-sm" type="button" on:click={() => openProfileModal({ keepMessages: true })} disabled={authBusy || pairBusy}>
                  Cập nhật hồ sơ
                </button>
              </div>
            {:else}
              <p class="mt-2 text-sm text-[color:var(--ink2)]">Chưa đăng nhập.</p>
            {/if}
          </div>

          <div class="rounded-xl border border-white/70 bg-white/70 p-3">
            <p class="text-xs font-semibold uppercase tracking-[.12em] text-pink-500/80">Phòng chung</p>
            {#if room}
              <p class="mt-2 text-sm text-[color:var(--ink2)]">
                Chủ phòng: <span class="font-semibold text-[color:var(--ink)]">{room.owner?.username ? `@${room.owner.username}` : "—"}</span>
              </p>
              <p class="mt-1 text-sm text-[color:var(--ink2)]">
                Người còn lại:
                <span class="font-semibold text-[color:var(--ink)]">{room.partner?.username ? `@${room.partner.username}` : "Chưa tham gia"}</span>
              </p>
            {:else}
              <p class="mt-2 text-sm text-[color:var(--ink2)]">Tạo mã hoặc nhập mã để vào phòng.</p>
            {/if}
          </div>
        </div>
      {/if}

      {#if room && room.status !== "paired"}
        <p class="mt-2 text-xs text-[color:var(--ink2)]">
          Gửi mã <strong>{room.code}</strong> hoặc link phòng cho người kia.
        </p>
      {/if}

      {#if infoText}
        <p class="mt-3 rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-2 text-sm text-sky-700">{infoText}</p>
      {/if}
      {#if errorText}
        <p class="mt-3 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{errorText}</p>
      {/if}
    </div>
  {:else}
  <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
    <div class="rounded-2xl border border-white/70 bg-white/65 p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Tài khoản</p>
          <p class="mt-1 text-sm text-[color:var(--ink2)]">
            {#if loading}
              Đang kiểm tra phiên đăng nhập...
            {:else if me}
              {displayAccountName}
            {:else}
              Chưa đăng nhập
            {/if}
          </p>
        </div>
        {#if me}
          <div class="h-10 w-10 rounded-xl bg-white/90 border border-white/90 flex items-center justify-center text-lg shrink-0">
            {providerIcon(me.provider)}
          </div>
        {/if}
      </div>

      {#if me}
        <div class="mt-3 flex flex-wrap gap-2 text-xs">
          <span class="pill">{providerName(me.provider)}</span>
          <span class="pill">
            {syncStatus === "synced"
              ? "Đã kết nối phòng"
              : syncStatus === "saving"
                ? "Đang lưu"
                : syncStatus === "error"
                  ? "Lỗi kết nối"
                  : syncStatus === "draft"
                    ? "Chưa ghép phòng"
                    : "Đang kiểm tra"}
          </span>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            class="btn btn-soft text-sm"
            type="button"
            on:click={() => openCredentialModal({ mode: "signin" })}
            disabled={authBusy || pairBusy}
          >
            Đổi tài khoản
          </button>
          <button class="btn btn-soft text-sm" type="button" on:click={() => openProfileModal({ keepMessages: true })} disabled={authBusy || pairBusy}>
            Cập nhật hồ sơ
          </button>
          <button class="btn btn-soft text-sm" type="button" on:click={logout} disabled={authBusy || pairBusy}>
            {authBusy ? "Đang thoát..." : "Đăng xuất"}
          </button>
        </div>
      {:else}
        <div class="mt-3 space-y-2">
          {#if !authConfigured}
            <p class="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Tính năng đăng nhập hiện chưa sẵn sàng.
            </p>
          {/if}
          {#if canUsePasswordLogin}
            <button class="btn btn-primary text-sm w-full sm:w-auto" type="button" on:click={() => openCredentialModal({ mode: "signin" })}>
              Đăng nhập
            </button>
          {/if}
        </div>
      {/if}
    </div>

    <div class="rounded-2xl border border-white/70 bg-white/65 p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Phòng chung</p>
          <p class="mt-1 text-sm text-[color:var(--ink2)]">
            {#if room}
              Mã: <span class="font-bold text-[color:var(--ink)]">{room.code}</span>
              ({room.status === "paired" ? "đã đủ 2 người" : "đang chờ người kia"})
            {:else}
              Tạo mã mới hoặc nhập mã để tham gia.
            {/if}
          </p>
        </div>
        {#if room}
          <span class="pill">{room.status === "paired" ? "Đã ghép cặp" : "Chờ ghép cặp"}</span>
        {/if}
      </div>

      <div class="mt-4">
        <label for="join_code" class="label">Mã ghép cặp (6 ký tự)</label>
        <input
          id="join_code"
          class="field mt-1 text-sm uppercase tracking-[.2em] text-center"
          type="text"
          placeholder="ABC123"
          maxlength="6"
          bind:value={joinCode}
          on:input={(e) => (joinCode = normalizeCode(e.currentTarget.value))}
          disabled={pairBusy || authBusy}
        />
      </div>

      <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button class="btn btn-soft text-sm w-full" type="button" on:click={joinPairCode} disabled={pairBusy || authBusy || !me}>
          {pairBusy ? "Đang xử lý..." : "Tham gia bằng mã"}
        </button>
        <button class="btn btn-primary text-sm w-full" type="button" on:click={() => createPairCode()} disabled={pairBusy || authBusy || !me}>
          {pairBusy ? "Đang tạo..." : "Tạo mã mới"}
        </button>
      </div>

      {#if room}
        <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div class="rounded-xl border border-white/70 bg-white/70 px-3 py-2.5">
            <p class="text-[11px] uppercase tracking-[.12em] text-[color:var(--ink2)]">Chủ phòng</p>
            <p class="mt-1 text-sm font-semibold text-[color:var(--ink)] truncate">{room.owner?.username ? `@${room.owner.username}` : "—"}</p>
          </div>
          <div class="rounded-xl border border-white/70 bg-white/70 px-3 py-2.5">
            <p class="text-[11px] uppercase tracking-[.12em] text-[color:var(--ink2)]">Người còn lại</p>
            <p class="mt-1 text-sm font-semibold text-[color:var(--ink)] truncate">{room.partner?.username ? `@${room.partner.username}` : "Chưa tham gia"}</p>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <button class="btn btn-soft text-sm" type="button" on:click={copyRoomLink} disabled={pairBusy || authBusy}>Copy link phòng</button>
          {#if needsConnect}
            <button class="btn btn-soft text-sm" type="button" on:click={reconnectCurrentRoom} disabled={pairBusy || authBusy}>
              Kết nối lại
            </button>
          {/if}
          {#if !hasStartDate}
            <button class="btn btn-soft text-sm" type="button" on:click={() => dispatch("openwizard")}>Wizard</button>
            <button class="btn btn-soft text-sm" type="button" on:click={() => dispatch("openimport")}>Nhập JSON</button>
          {/if}
        </div>
      {/if}

      {#if room && room.status !== "paired"}
        <p class="mt-2 text-xs text-[color:var(--ink2)]">
          Gửi mã <strong>{room.code}</strong> hoặc link phòng cho người kia.
        </p>
      {/if}

      {#if infoText}
        <p class="mt-3 rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-2 text-sm text-sky-700">{infoText}</p>
      {/if}
      {#if errorText}
        <p class="mt-3 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{errorText}</p>
      {/if}
    </div>
  </div>
  {/if}
</section>
    </div>
  </div>
</div>

<div class={`modal ${credentialModalOpen ? "open" : ""}`} aria-hidden={!credentialModalOpen} on:click|self={closeCredentialModal}>
  <div
    class="modal-card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="credentialAuthTitle"
    tabindex="-1"
    style="max-width: 34rem;"
  >
    <div class="flex items-center justify-between border-b border-pink-100/70 px-4 py-3 sm:px-5">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Tài khoản</p>
        <h3 id="credentialAuthTitle" class="text-lg font-bold text-[color:var(--ink)]">
          {credentialMode === "signup" ? "Tạo tài khoản" : "Đăng nhập"}
        </h3>
      </div>
      <button type="button" class="btn btn-soft text-sm" on:click={closeCredentialModal} disabled={authBusy}>Đóng</button>
    </div>

    <div class="px-4 py-4 sm:px-5">
      <form class="space-y-3" on:submit|preventDefault={submitCredentialAuth}>
        <div class="rounded-2xl border border-white/70 bg-white/70 p-4">
          <div class="flex items-center gap-2 text-xs">
            <button
              type="button"
              class={`pill ${credentialMode === "signin" ? "!bg-pink-100 !text-pink-700" : ""}`}
              on:click={() => (credentialMode = "signin")}
              disabled={authBusy}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              class={`pill ${credentialMode === "signup" ? "!bg-pink-100 !text-pink-700" : ""}`}
              on:click={() => (credentialMode = "signup")}
              disabled={authBusy}
            >
              Tạo tài khoản
            </button>
            {#if pendingAutoPairAfterAuth}
              <span class="pill">Tự tạo mã sau đăng nhập</span>
            {/if}
          </div>

          <p class="mt-2 text-sm text-[color:var(--ink2)]">
            {#if credentialMode === "signup"}
              Tạo tài khoản bằng tên đăng nhập và mật khẩu để dùng chung phòng cặp đôi.
            {:else}
              Nhập tên đăng nhập và mật khẩu để tiếp tục ghép cặp.
            {/if}
          </p>

          <div class="mt-3">
            <label class="label" for="cred_username">Tên đăng nhập</label>
            <input
              id="cred_username"
              class="field mt-1 text-sm"
              type="text"
              placeholder="ví dụ: hieu_duong"
              autocomplete="username"
              maxlength="32"
              bind:value={loginUsername}
              on:input={(e) => (loginUsername = sanitizeUsername(e.currentTarget.value))}
              disabled={authBusy}
            />
            <p class="mt-1 text-xs text-[color:var(--ink2)]">Chỉ dùng chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.</p>
          </div>

          <div class="mt-3">
            <label class="label" for="cred_password">Mật khẩu</label>
            <input
              id="cred_password"
              class="field mt-1 text-sm"
              type="password"
              placeholder="Ít nhất 6 ký tự"
              autocomplete={credentialMode === "signup" ? "new-password" : "current-password"}
              bind:value={loginPassword}
              disabled={authBusy}
            />
          </div>

          {#if credentialMode === "signup"}
            <div class="mt-3">
              <label class="label" for="cred_password_confirm">Nhập lại mật khẩu</label>
              <input
                id="cred_password_confirm"
                class="field mt-1 text-sm"
                type="password"
                placeholder="Nhập lại mật khẩu"
                autocomplete="new-password"
                bind:value={loginPasswordConfirm}
                disabled={authBusy}
              />
            </div>
          {/if}

          <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button class="btn btn-primary text-sm w-full" type="submit" disabled={authBusy}>
              {#if authBusy}
                {credentialMode === "signup" ? "Đang tạo tài khoản..." : "Đang đăng nhập..."}
              {:else}
                {credentialMode === "signup" ? "Tạo tài khoản" : "Đăng nhập"}
              {/if}
            </button>
            <button
              class="btn btn-soft text-sm w-full"
              type="button"
              on:click={() => {
                credentialMode = credentialMode === "signup" ? "signin" : "signup";
                errorText = "";
              }}
              disabled={authBusy}
            >
              {credentialMode === "signup" ? "Đã có tài khoản" : "Tạo tài khoản mới"}
            </button>
          </div>
        </div>

        {#if errorText}
          <p class="rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{errorText}</p>
        {/if}
        {#if infoText}
          <p class="rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-2 text-sm text-sky-700">{infoText}</p>
        {/if}
      </form>
    </div>
  </div>
</div>

<div class={`modal ${profileModalOpen ? "open" : ""}`} aria-hidden={!profileModalOpen} on:click|self={closeProfileModal}>
  <div
    class="modal-card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="profileModalTitle"
    tabindex="-1"
    style="max-width: 38rem;"
  >
    <div class="flex items-center justify-between border-b border-pink-100/70 px-4 py-3 sm:px-5">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Hồ sơ cá nhân</p>
        <h3 id="profileModalTitle" class="text-lg font-bold text-[color:var(--ink)]">Thông tin đăng ký</h3>
      </div>
      <button type="button" class="btn btn-soft text-sm" on:click={closeProfileModal} disabled={profileBusy}>Đóng</button>
    </div>

    <div class="px-4 py-4 sm:px-5">
      <form class="space-y-3" on:submit|preventDefault={saveMyProfile}>
        <div class="rounded-2xl border border-white/70 bg-white/70 p-4">
          <div class="flex items-start gap-3">
            <img
              src={profileAvatarPreview}
              alt="Avatar cá nhân"
              class="h-20 w-20 rounded-2xl object-cover border border-pink-200/70 bg-white"
              on:error={onProfileImageError}
            />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-[color:var(--ink)]">Thông tin này sẽ được dùng khi bạn đăng nhập</p>
              <p class="mt-1 text-xs text-[color:var(--ink2)]">Tên, ngày sinh, giới tính và avatar sẽ tự hiện trong hồ sơ cặp đôi.</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <button class="btn btn-soft text-sm" type="button" on:click={() => (profileDraft.useDefault = true)} disabled={profileBusy}>
                  Dùng avatar mặc định
                </button>
              </div>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label class="label" for="reg_name">Tên hiển thị</label>
              <input id="reg_name" class="field mt-1 text-sm" type="text" maxlength="60" bind:value={profileDraft.name} disabled={profileBusy} />
            </div>

            <div>
              <label class="label" for="reg_birthday">Ngày sinh</label>
              <input id="reg_birthday" class="field mt-1 text-sm" type="date" bind:value={profileDraft.birthday} disabled={profileBusy} />
            </div>

            <div>
              <label class="label" for="reg_gender">Giới tính</label>
              <select id="reg_gender" class="field mt-1 text-sm" bind:value={profileDraft.gender} disabled={profileBusy}>
                <option value="nam">Nam</option>
                <option value="nu">Nữ</option>
                <option value="khac">Khác</option>
                <option value="khong_tiet_lo">Không tiết lộ</option>
              </select>
            </div>

            <div class="sm:col-span-2">
              <label class="label" for="reg_avatar_url">Avatar URL (tuỳ chọn)</label>
              <input
                id="reg_avatar_url"
                class="field mt-1 text-sm"
                type="url"
                placeholder="https://..."
                bind:value={profileDraft.avatarUrlInput}
                disabled={profileBusy}
                on:input={() => {
                  if (profileDraft.avatarUrlInput?.trim()) profileDraft.useDefault = false;
                }}
              />
            </div>

            <div class="sm:col-span-2">
              <label class="label" for="reg_avatar_upload">Tải ảnh lên (tuỳ chọn)</label>
              <input
                id="reg_avatar_upload"
                class="field mt-1 text-sm"
                type="file"
                accept="image/*"
                disabled={profileBusy}
                on:change={(e) => onProfileAvatarFile(e.currentTarget.files?.[0] || null)}
              />
            </div>
          </div>
        </div>

        {#if errorText}
          <p class="rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{errorText}</p>
        {/if}
        {#if infoText}
          <p class="rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-2 text-sm text-sky-700">{infoText}</p>
        {/if}

        <div class="flex justify-end gap-2">
          <button class="btn btn-soft text-sm" type="button" on:click={closeProfileModal} disabled={profileBusy}>Để sau</button>
          <button class="btn btn-primary text-sm" type="submit" disabled={profileBusy}>
            {profileBusy ? "Đang lưu..." : "Lưu hồ sơ"}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

{#if SHOW_PROVIDER_LOGIN}
<div class={`modal ${providerPickerOpen ? "open" : ""}`} aria-hidden={!providerPickerOpen} on:click|self={closeProviderPicker}>
  <div
    class="modal-card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="providerPickerTitle"
    tabindex="-1"
    style="max-width: 46rem;"
  >
    <div class="flex items-center justify-between border-b border-pink-100/70 px-4 py-3 sm:px-5">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Đăng nhập</p>
        <h3 id="providerPickerTitle" class="text-lg font-bold text-[color:var(--ink)]">Chọn tài khoản để tiếp tục</h3>
      </div>
      <button type="button" class="btn btn-soft text-sm" on:click={closeProviderPicker} disabled={authBusy}>Đóng</button>
    </div>

    <div class="max-h-[78vh] overflow-y-auto px-4 py-4 sm:px-5">
      <div class="rounded-2xl border border-white/70 bg-white/65 p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="pill">Đăng nhập nhanh</span>
          {#if pendingAutoPairAfterAuth}
            <span class="pill">Tự tạo mã sau đăng nhập</span>
          {/if}
        </div>
        <p class="mt-2 text-sm text-[color:var(--ink2)]">
          {#if pendingAutoPairAfterAuth}
            Sau khi đăng nhập xong và quay lại trang, Lingo sẽ tự tạo mã ghép cặp 6 ký tự cho bạn.
          {:else}
            Chọn một tài khoản để đăng nhập và tiếp tục ghép cặp.
          {/if}
        </p>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {#each providers as provider}
          <button
            type="button"
            class="group relative overflow-hidden rounded-2xl border border-white/80 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 min-h-[112px]"
            on:click={() => startAuthLogin(provider.id)}
            disabled={authBusy || pairBusy}
          >
            <div class={`pointer-events-none absolute inset-0 bg-gradient-to-br ${providerAccent(provider.id)}`}></div>
            <div class="relative">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="h-11 w-11 rounded-xl border border-white/90 bg-white/90 flex items-center justify-center text-xl shadow-sm shrink-0">
                    {providerIcon(provider.id)}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-bold text-[color:var(--ink)] truncate">{providerName(provider.id, provider.name)}</p>
                    <p class="text-xs text-[color:var(--ink2)]">Đăng nhập</p>
                  </div>
                </div>
                <span class="pill text-[11px] shrink-0">Chọn</span>
              </div>
              <p class="mt-3 text-xs leading-5 text-[color:var(--ink2)]">
                {providerHint(provider.id)}
              </p>
            </div>
          </button>
        {/each}
      </div>

      {#if providerPickerReason === "wizard-auto"}
        <p class="mt-4 rounded-xl border border-pink-200/80 bg-pink-50/80 px-3 py-2 text-sm text-pink-700">
          Wizard đã hoàn tất. Bước tiếp theo là đăng nhập để hệ thống tự tạo mã ghép cặp cho hai bạn.
        </p>
      {/if}
    </div>
  </div>
</div>
{/if}
