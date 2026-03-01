import { derived, get, writable } from "svelte/store";
import {
  getSupabaseClient,
  isSchemaMissingError,
  sanitizeRoomCode,
  sanitizeUsername,
  upsertMyUserProfile,
} from "./supabaseClient.js";
import { fallbackFlamingoAvatar } from "./utils.js";
import { createAuthSlice } from "./auth-pairing/authSlice.js";
import { createOAuthSlice } from "./auth-pairing/oauthSlice.js";
import { createPairingSlice } from "./auth-pairing/pairingSlice.js";
import { createProfileSlice } from "./auth-pairing/profileSlice.js";
import {
  INITIAL_STATE,
  SHOW_PROVIDER_LOGIN,
  normalizeCode as normalizeCodeShared,
  providerAccent,
  providerHint,
  providerIcon,
  providerName,
  toErrorMessage as toErrorMessageShared,
} from "./auth-pairing/shared.js";

export function createAuthPairingController({
  onToast = () => {},
  onAuthState = () => {},
  onClose = () => {},
  onOpenWizard = () => {},
  onRefreshRoom = () => {},
  onRoomConnect = () => {},
} = {}) {
  const fallbackAvatar = fallbackFlamingoAvatar(160);
  const state = writable({
    ...INITIAL_STATE,
    profileDraft: { ...INITIAL_STATE.profileDraft },
  });
  const props = writable({ currentRoomId: "", hasStartDate: false, open: false });
  let applyingGuards = false;

  function normalizeCode(value) {
    return normalizeCodeShared(value, sanitizeRoomCode);
  }

  function toErrorMessage(err, fallback = "Không thể thực hiện thao tác.") {
    return toErrorMessageShared(err, isSchemaMissingError, fallback);
  }

  const view = derived([state, props], ([$s, $p]) => {
    const effectiveRoomCode = $s.room?.code || $p.currentRoomId || "";
    return {
      ...$s,
      ...$p,
      showProviderLogin: SHOW_PROVIDER_LOGIN,
      effectiveRoomCode,
      needsConnect: !!effectiveRoomCode && $p.currentRoomId !== effectiveRoomCode,
      canUsePasswordLogin: $s.authConfigured && !$s.me,
      displayAccountName: $s.myProfile?.name || $s.me?.username || "user",
      profileAvatarPreview: $s.profileDraft.useDefault
        ? fallbackAvatar
        : ($s.profileDraft.uploadedAvatarData || $s.profileDraft.avatarUrlInput?.trim() || $s.profileDraft.existingAvatarUrl || fallbackAvatar),
    };
  });

  function patch(partial, runGuards = true) {
    state.update((prev) => ({
      ...prev,
      ...(typeof partial === "function" ? partial(prev) : partial),
    }));
    if (runGuards) applyGuards();
  }

  function getState() {
    return get(state);
  }

  function getProps() {
    return get(props);
  }

  function syncProps(next = {}) {
    props.update((prev) => ({
      ...prev,
      ...(Object.prototype.hasOwnProperty.call(next, "currentRoomId")
        ? { currentRoomId: String(next.currentRoomId || "").trim() }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(next, "hasStartDate")
        ? { hasStartDate: !!next.hasStartDate }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(next, "open") ? { open: !!next.open } : {}),
    }));
    applyGuards();
  }

  function emitToast(message) {
    if (message) onToast(message);
  }

  function emitAuth() {
    const $s = getState();
    onAuthState({
      authenticated: !!$s.me?.id,
      loading: !!$s.loading,
      roomCode: $s.room?.code || "",
      joinCode: preferredJoinCode(),
    });
  }

  function clearMessages() {
    patch({ errorText: "", infoText: "" });
  }

  function preferredJoinCode() {
    const $s = getState();
    const $p = getProps();
    const fromCurrent = normalizeCode($p.currentRoomId);
    if (fromCurrent.length === 6) return fromCurrent;
    const fromPending = normalizeCode($s.pendingJoinCodeAfterAuth);
    if (fromPending.length === 6) return fromPending;
    const fromInput = normalizeCode($s.joinCode);
    if (fromInput.length === 6) return fromInput;
    return "";
  }

  let authSlice;
  let pairingSlice;

  async function maybeAutoJoinExistingRoom() {
    const $s = getState();
    if ($s.pairBusy || $s.authBusy || !$s.me || $s.room?.code) return false;

    const code = preferredJoinCode();
    if (code.length !== 6) return false;

    patch({ joinCode: code });
    if (!profileSlice.hasValidProfile()) {
      patch({ pendingJoinCodeAfterAuth: code });
      profileSlice.openProfileModal({ required: true, keepMessages: true });
      return false;
    }

    await pairingSlice.joinPairCode();
    return true;
  }

  async function handleWizardCompletedAutoPair() {
    patch({ errorText: "" });
    await authSlice.refreshAuthPairState();

    const $s = getState();
    const $p = getProps();

    if ($s.room?.code) {
      if (($s.room.roomId || $s.room.code) !== $p.currentRoomId) {
        onRoomConnect({
          roomId: $s.room.roomId || $s.room.code,
          code: $s.room.code,
          room: $s.room,
          source: "wizard-existing-room",
        });
      }
      patch({ infoText: `Bạn đã có mã phòng ${$s.room.code}. Gửi cho người kia để ghép cặp.` });
      emitToast(`Mã phòng hiện tại: ${$s.room.code}`);
      return;
    }

    if (!$s.me) {
      patch({ infoText: "Đã lưu Wizard. Đăng nhập bằng tên đăng nhập và mật khẩu để hệ thống tự tạo mã ghép cặp." });
      emitToast("Đăng nhập để tạo mã ghép cặp.");
      authSlice.openCredentialModal({ mode: "signin", autoPair: true });
      return;
    }

    if (!profileSlice.hasValidProfile()) {
      patch({ infoText: "Hãy cập nhật hồ sơ cá nhân trước khi tạo mã ghép cặp." });
      profileSlice.openProfileModal({ required: true, keepMessages: true });
      return;
    }

    if (!$p.hasStartDate) return;
    await pairingSlice.createPairCode({ auto: true, keepInfo: false });
  }

  const profileSlice = createProfileSlice({
    getState,
    patch,
    fallbackAvatar,
    sanitizeUsername,
    upsertMyUserProfile,
    getSupabaseClient,
    toErrorMessage,
    emitToast,
    onAfterProfileSaved: async () => {
      if (await maybeAutoJoinExistingRoom()) {
        patch({ pendingJoinCodeAfterAuth: "" });
      } else {
        const now = getState();
        const $p = getProps();
        if (now.pendingAutoPairAfterAuth && $p.hasStartDate && !now.room) {
          await pairingSlice.createPairCode({ auto: true, keepInfo: false });
        } else if (now.room?.code) {
          pairingSlice.reconnectCurrentRoom();
        }
      }
    },
  });

  const oauthSlice = createOAuthSlice({
    getState,
    patch,
    emitToast,
  });

  pairingSlice = createPairingSlice({
    getState,
    getProps,
    patch,
    normalizeCode,
    toErrorMessage,
    emitToast,
    hasValidProfile: profileSlice.hasValidProfile,
    openProfileModal: profileSlice.openProfileModal,
    openCredentialModal: (options) => authSlice.openCredentialModal(options),
    onOpenWizard,
    onRoomConnect,
  });

  authSlice = createAuthSlice({
    getState,
    getProps,
    patch,
    normalizeCode,
    clearMessages,
    preferredJoinCode,
    emitToast,
    emitAuth,
    toErrorMessage,
    showProviderLogin: SHOW_PROVIDER_LOGIN,
    buildAuthRedirectUrl: oauthSlice.buildAuthRedirectUrl,
    profileFromRow: profileSlice.profileFromRow,
    hasValidProfile: profileSlice.hasValidProfile,
    openProfileModal: profileSlice.openProfileModal,
    maybeAutoJoinExistingRoom,
    reconnectCurrentRoom: pairingSlice.reconnectCurrentRoom,
    createPairCode: pairingSlice.createPairCode,
    onRefreshRoom,
  });

  function requestClose() {
    const $s = getState();
    if ($s.authBusy && ($s.providerPickerOpen || $s.credentialModalOpen)) return;
    patch({ providerPickerOpen: false, credentialModalOpen: false });
    onClose();
  }

  function handleKeydown(event) {
    if (event.key !== "Escape") return;
    const $s = getState();
    const $p = getProps();
    if ($s.credentialModalOpen) {
      event.preventDefault();
      authSlice.closeCredentialModal();
      return;
    }
    if ($s.providerPickerOpen) {
      event.preventDefault();
      authSlice.closeProviderPicker();
      return;
    }
    if ($p.open) {
      event.preventDefault();
      requestClose();
    }
  }

  function applyGuards() {
    if (applyingGuards) return;
    applyingGuards = true;
    try {
      const $s = getState();
      const $p = getProps();

      if (!$p.open) {
        const next = {};
        if ($s.providerPickerOpen) next.providerPickerOpen = false;
        if ($s.credentialModalOpen) next.credentialModalOpen = false;
        if ($s.profileModalOpen) next.profileModalOpen = false;
        if ($s.profilePromptedForUserId) next.profilePromptedForUserId = "";
        if (Object.keys(next).length) patch(next, false);
        return;
      }

      if (!$s.me?.id || profileSlice.hasValidProfile($s.myProfile)) {
        if ($s.profilePromptedForUserId) patch({ profilePromptedForUserId: "" }, false);
      } else if (!$s.profileModalOpen && !$s.authBusy && !$s.profileBusy && $s.profilePromptedForUserId !== $s.me.id) {
        patch({ profilePromptedForUserId: $s.me.id }, false);
        profileSlice.openProfileModal({ required: true, keepMessages: true });
        return;
      }

      if ($p.open && !$s.loading && !$s.authBusy && $s.authConfigured && !$s.me && !$s.credentialModalOpen && !$s.providerPickerOpen) {
        authSlice.openCredentialModal({ mode: "signin", keepMessages: true, clearPassword: false });
      }
    } finally {
      applyingGuards = false;
    }
  }

  async function mount() {
    oauthSlice.consumeAuthQueryFlags();
    await authSlice.refreshAuthPairState();
    authSlice.setupAuthStateListener();

    if (await maybeAutoJoinExistingRoom()) {
      patch({ pendingJoinCodeAfterAuth: "" });
      return;
    }

    const $s = getState();
    const $p = getProps();
    if ($s.autoPairRequestedFromQuery && $s.me && $p.hasStartDate && !$s.room) {
      await pairingSlice.createPairCode({ auto: true, keepInfo: false });
    } else if ($s.autoPairRequestedFromQuery && !$s.me) {
      patch({ infoText: "Đăng nhập chưa hoàn tất. Vui lòng nhập lại tên đăng nhập và mật khẩu." });
      authSlice.openCredentialModal({ mode: "signin", autoPair: true });
    }
  }

  function destroy() {
    authSlice.cleanupAuthStateListener();
  }

  function setJoinCode(value) {
    patch({ joinCode: normalizeCode(value) });
  }

  function toggleDetails() {
    patch((prev) => ({ detailsExpanded: !prev.detailsExpanded }));
  }

  function setCredentialMode(mode) {
    patch({ credentialMode: mode === "signup" ? "signup" : "signin" });
  }

  function toggleCredentialMode() {
    patch((prev) => ({
      credentialMode: prev.credentialMode === "signup" ? "signin" : "signup",
      errorText: "",
    }));
  }

  function setLoginUsername(value) {
    patch({ loginUsername: sanitizeUsername(value) });
  }

  function setLoginPassword(value) {
    patch({ loginPassword: String(value || "") });
  }

  function setLoginPasswordConfirm(value) {
    patch({ loginPasswordConfirm: String(value || "") });
  }

  return {
    state,
    view,
    syncProps,
    mount,
    destroy,
    requestClose,
    handleKeydown,
    refreshAuthPairState: authSlice.refreshAuthPairState,
    logout: authSlice.logout,
    openCredentialModal: authSlice.openCredentialModal,
    closeCredentialModal: authSlice.closeCredentialModal,
    submitCredentialAuth: authSlice.submitCredentialAuth,
    openProfileModal: profileSlice.openProfileModal,
    closeProfileModal: profileSlice.closeProfileModal,
    saveMyProfile: profileSlice.saveMyProfile,
    openProviderPicker: authSlice.openProviderPicker,
    closeProviderPicker: authSlice.closeProviderPicker,
    startAuthLogin: authSlice.startAuthLogin,
    joinPairCode: pairingSlice.joinPairCode,
    createPairCode: pairingSlice.createPairCode,
    copyRoomLink: pairingSlice.copyRoomLink,
    reconnectCurrentRoom: pairingSlice.reconnectCurrentRoom,
    handleWizardCompletedAutoPair,
    onProfileAvatarFile: profileSlice.onProfileAvatarFile,
    onProfileImageError: profileSlice.onProfileImageError,
    setJoinCode,
    toggleDetails,
    setCredentialMode,
    toggleCredentialMode,
    setLoginUsername,
    setLoginPassword,
    setLoginPasswordConfirm,
    useDefaultAvatar: profileSlice.useDefaultAvatar,
    updateProfileDraft: profileSlice.updateProfileDraft,
    providerName,
    providerIcon,
    providerHint,
    providerAccent,
  };
}
