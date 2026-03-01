import {
  getCurrentAuthUser,
  getEnabledAuthProviders,
  getMyPairRoom,
  getMyUserProfile,
  getSupabaseClient,
  getSupabaseConfigError,
  isSupabaseConfigured,
  mapRoomRowToDto,
  sanitizeUsername,
  signInWithProvider,
  signInWithUsernamePassword,
  signOutAuth,
  signUpWithUsernamePassword,
} from "../supabaseClient.js";

export function createAuthSlice({
  getState,
  getProps,
  patch,
  normalizeCode,
  clearMessages,
  preferredJoinCode,
  emitToast,
  emitAuth,
  toErrorMessage,
  showProviderLogin,
  buildAuthRedirectUrl,
  profileFromRow,
  hasValidProfile,
  openProfileModal,
  maybeAutoJoinExistingRoom,
  reconnectCurrentRoom,
  createPairCode,
  onRefreshRoom,
} = {}) {
  let authSubscription = null;

  async function refreshAuthPairState() {
    patch({
      loading: true,
      errorText: "",
      providers: getEnabledAuthProviders(),
      authConfigured: isSupabaseConfigured(),
    });

    const cfgErr = getSupabaseConfigError();
    if (cfgErr) {
      const props = getProps();
      patch((prev) => ({
        me: null,
        room: null,
        joinCode: prev.joinCode || normalizeCode(props.currentRoomId),
        errorText: "Tính năng đăng nhập tạm thời chưa sẵn sàng.",
        loading: false,
      }));
      emitAuth();
      return;
    }

    try {
      const client = getSupabaseClient();
      const me = await getCurrentAuthUser(client);

      if (me) {
        const profileRow = await getMyUserProfile(client).catch(() => null);
        const roomRow = await getMyPairRoom(client).catch((err) => {
          if (String(err?.message || "").includes("0 rows")) return null;
          throw err;
        });
        const mappedRoom = mapRoomRowToDto(roomRow, me.id);
        patch((prev) => ({
          me,
          myProfile: profileFromRow(profileRow, me),
          room: mappedRoom,
          joinCode: mappedRoom?.code
            ? String(mappedRoom.code).toUpperCase()
            : (prev.joinCode || normalizeCode(getProps().currentRoomId)),
        }));
      } else {
        patch((prev) => ({
          me: null,
          room: null,
          myProfile: null,
          joinCode: prev.joinCode || normalizeCode(getProps().currentRoomId),
        }));
      }
    } catch (err) {
      patch({ errorText: toErrorMessage(err, "Không thể tải trạng thái đăng nhập.") });
    } finally {
      patch({ loading: false });
      emitAuth();
    }
  }

  function openProviderPicker(options = {}) {
    if (!showProviderLogin) {
      openCredentialModal({ mode: "signin", autoPair: !!options.autoPair });
      return;
    }

    const cfgErr = getSupabaseConfigError();
    if (cfgErr) {
      patch({ errorText: "Tính năng đăng nhập tạm thời chưa sẵn sàng." });
      return;
    }
    if (!getState().providers.length) {
      patch({ errorText: "Hiện chưa có cách đăng nhập nào khả dụng." });
      return;
    }

    patch({
      providerPickerReason: String(options.reason || ""),
      providerPickerOpen: true,
      ...(options.autoPair ? { pendingAutoPairAfterAuth: true } : {}),
    });
  }

  function closeProviderPicker() {
    if (getState().authBusy) return;
    patch({ providerPickerOpen: false });
  }

  function openCredentialModal(options = {}) {
    const cfgErr = getSupabaseConfigError();
    if (cfgErr) {
      patch({ errorText: "Tính năng đăng nhập tạm thời chưa sẵn sàng." });
      return;
    }

    if (!options.keepMessages) clearMessages();
    patch((prev) => ({
      providerPickerOpen: false,
      credentialMode: options.mode === "signup" ? "signup" : "signin",
      credentialModalOpen: true,
      ...(options.autoPair ? { pendingAutoPairAfterAuth: true } : {}),
      ...(options.clearPassword !== false
        ? { loginPassword: "", loginPasswordConfirm: "" }
        : {}),
      ...(options.focusUsername && !prev.loginUsername ? { loginUsername: "" } : {}),
    }));
  }

  function closeCredentialModal() {
    if (getState().authBusy) return;
    patch({ credentialModalOpen: false });
  }

  function resetCredentialInputs() {
    patch({
      loginPassword: "",
      loginPasswordConfirm: "",
    });
  }

  async function submitCredentialAuth() {
    const state = getState();
    if (state.authBusy) return;
    clearMessages();

    const username = sanitizeUsername(state.loginUsername);
    const password = String(state.loginPassword || "");
    const confirm = String(state.loginPasswordConfirm || "");

    if (!username) {
      patch({ errorText: "Vui lòng nhập tên đăng nhập (chỉ gồm chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang)." });
      return;
    }
    if (password.length < 6) {
      patch({ errorText: "Mật khẩu cần ít nhất 6 ký tự." });
      return;
    }
    if (state.credentialMode === "signup" && password !== confirm) {
      patch({ errorText: "Mật khẩu xác nhận chưa khớp." });
      return;
    }

    patch({ authBusy: true });
    try {
      const client = getSupabaseClient();
      const mode = getState().credentialMode;

      if (mode === "signup") {
        const data = await signUpWithUsernamePassword({ username, password }, client);
        if (data?.needsEmailConfirmation) {
          patch({
            infoText:
              "Tài khoản đã được tạo nhưng Supabase đang bật xác nhận email. Với chế độ đăng nhập tên đăng nhập, hãy tắt Email Confirmations trong Supabase Auth rồi thử lại.",
          });
        } else {
          patch({ infoText: "Đã tạo tài khoản và đăng nhập thành công." });
          emitToast("Đã tạo tài khoản.");
        }
      } else {
        await signInWithUsernamePassword({ username, password }, client);
        patch({ infoText: "Đăng nhập thành công." });
        emitToast("Đăng nhập thành công.");
      }

      patch({
        loginUsername: username,
        credentialModalOpen: false,
      });
      resetCredentialInputs();
      await refreshAuthPairState();

      if (await maybeAutoJoinExistingRoom()) {
        patch({ pendingJoinCodeAfterAuth: "" });
      } else if (!hasValidProfile()) {
        openProfileModal({ required: true, keepMessages: true });
      } else {
        const now = getState();
        const props = getProps();
        if (now.room?.code) {
          reconnectCurrentRoom();
        } else if (now.pendingAutoPairAfterAuth && props.hasStartDate && !now.room) {
          await createPairCode({ auto: true, keepInfo: false });
        }
      }
    } catch (err) {
      const msg = String(err?.message || "").toLowerCase();
      if (
        msg.includes("invalid login credentials") ||
        msg.includes("email not confirmed") ||
        msg.includes("invalid_credentials")
      ) {
        patch({ errorText: "Tên đăng nhập hoặc mật khẩu chưa đúng." });
      } else if (msg.includes("user already registered")) {
        patch({ errorText: "Tên đăng nhập này đã tồn tại." });
      } else if (msg.includes("password should be at least")) {
        patch({ errorText: "Mật khẩu cần ít nhất 6 ký tự." });
      } else {
        patch({ errorText: toErrorMessage(err, "Không thể đăng nhập.") });
      }
    } finally {
      patch({ authBusy: false });
    }
  }

  async function startAuthLogin(providerId) {
    const pid = String(providerId || "").trim();
    if (!pid) return;

    patch({
      authBusy: true,
      errorText: "",
    });

    try {
      const client = getSupabaseClient();
      const redirectTo = buildAuthRedirectUrl();
      const data = await signInWithProvider(pid, { redirectTo }, client);
      patch({ providerPickerOpen: false });

      if (data?.url && typeof window !== "undefined") {
        window.location.assign(data.url);
        return;
      }

      patch({
        authBusy: false,
        infoText: "Đã gửi yêu cầu đăng nhập. Nếu chưa chuyển trang, hãy kiểm tra cấu hình provider.",
      });
    } catch (err) {
      patch({
        authBusy: false,
        errorText: toErrorMessage(err, "Không thể bắt đầu đăng nhập."),
      });
    }
  }

  async function logout() {
    patch({ authBusy: true });
    clearMessages();

    try {
      const client = getSupabaseClient();
      await signOutAuth(client);
      patch({
        me: null,
        room: null,
        myProfile: null,
        joinCode: "",
        pendingJoinCodeAfterAuth: "",
        pendingAutoPairAfterAuth: false,
        autoPairRequestedFromQuery: false,
        profileModalOpen: false,
        profilePromptedForUserId: "",
        infoText: "Đã đăng xuất.",
      });
      emitToast("Đã đăng xuất.");
      emitAuth();
      onRefreshRoom({ clearRoomQuery: true });
    } catch (err) {
      patch({ errorText: toErrorMessage(err, "Không thể đăng xuất.") });
    } finally {
      patch({ authBusy: false });
    }
  }

  function setupAuthStateListener() {
    try {
      const client = getSupabaseClient();
      const result = client.auth.onAuthStateChange(() => {
        refreshAuthPairState().catch((err) => {
          console.error(err);
          patch({ errorText: toErrorMessage(err, "Không thể cập nhật trạng thái đăng nhập.") });
        });
      });
      authSubscription = result?.data?.subscription || null;
    } catch {
      authSubscription = null;
    }
  }

  function cleanupAuthStateListener() {
    try {
      authSubscription?.unsubscribe?.();
    } catch {
      // noop
    }
  }

  return {
    refreshAuthPairState,
    openProviderPicker,
    closeProviderPicker,
    openCredentialModal,
    closeCredentialModal,
    submitCredentialAuth,
    startAuthLogin,
    logout,
    setupAuthStateListener,
    cleanupAuthStateListener,
  };
}
