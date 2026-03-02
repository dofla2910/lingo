<script>
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import AuthCredentialModal from "./AuthCredentialModal.svelte";
  import AuthProfileModal from "./AuthProfileModal.svelte";
  import AuthPairingMainSection from "./AuthPairingMainSection.svelte";
  import AuthProviderPickerModal from "./AuthProviderPickerModal.svelte";
  import ModalShell from "./ModalShell.svelte";
  import { createAuthPairingController } from "../lingo/authPairingController.js";

  export let currentRoomId = "";
  export let syncStatus = "connecting";
  export let hasStartDate = false;
  export let ultraMinimal = false;
  export let open = false;

  const dispatch = createEventDispatcher();
  const controller = createAuthPairingController({
    onToast: (message) => dispatch("toast", message),
    onAuthState: (detail) => dispatch("authstate", detail),
    onClose: () => dispatch("close"),
    onOpenWizard: () => dispatch("openwizard"),
    onRefreshRoom: (detail) => dispatch("refreshroom", detail),
    onRoomConnect: (detail) => dispatch("roomconnect", detail),
  });

  const view = controller.view;

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
  let detailsExpanded = false;
  let credentialModalOpen = false;
  let credentialMode = "signin";
  let loginUsername = "";
  let loginPassword = "";
  let loginPasswordConfirm = "";
  let profileModalOpen = false;
  let profileBusy = false;
  let profileDraft = {
    name: "",
    birthday: "",
    gender: "khong_tiet_lo",
    avatarUrlInput: "",
    uploadedAvatarData: "",
    useDefault: true,
    existingAvatarUrl: "",
  };
  let profileAvatarPreview = "";
  let needsConnect = false;
  let canUsePasswordLogin = false;
  let displayAccountName = "user";
  let showProviderLogin = false;

  $: controller.syncProps({ currentRoomId, hasStartDate, open });

  $: ({
    loading,
    authBusy,
    pairBusy,
    me,
    room,
    providers,
    authConfigured,
    joinCode,
    errorText,
    infoText,
    providerPickerOpen,
    providerPickerReason,
    pendingAutoPairAfterAuth,
    detailsExpanded,
    credentialModalOpen,
    credentialMode,
    loginUsername,
    loginPassword,
    loginPasswordConfirm,
    profileModalOpen,
    profileBusy,
    profileDraft,
    profileAvatarPreview,
    needsConnect,
    canUsePasswordLogin,
    displayAccountName,
    showProviderLogin,
  } = $view);

  onMount(() => {
    controller.mount();
  });

  onDestroy(() => {
    controller.destroy();
  });

  export async function handleWizardCompletedAutoPair() {
    await controller.handleWizardCompletedAutoPair();
  }
</script>

<svelte:window on:keydown={controller.handleKeydown} />

<ModalShell
  open={open}
  close={controller.requestClose}
  labelledBy="pairingPanelTitle"
  preset="modal-preset-form"
  cardStyle="max-width: 74rem;"
>
  <div slot="header" class="flex items-center justify-between">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Kết nối cặp đôi</p>
      <h3 id="pairingPanelTitle" class="text-lg font-bold text-[color:var(--ink)]">Đăng nhập & ghép cặp</h3>
    </div>
    <!-- <button type="button" class="btn btn-soft text-sm" on:click={controller.requestClose}>Đóng</button> -->
  </div>

  <AuthPairingMainSection
    ultraMinimal={ultraMinimal}
    loading={loading}
    authBusy={authBusy}
    pairBusy={pairBusy}
    me={me}
    room={room}
    joinCode={joinCode}
    hasStartDate={hasStartDate}
    infoText={infoText}
    errorText={errorText}
    detailsExpanded={detailsExpanded}
    displayAccountName={displayAccountName}
    syncStatus={syncStatus}
    authConfigured={authConfigured}
    canUsePasswordLogin={canUsePasswordLogin}
    needsConnect={needsConnect}
    providerName={controller.providerName}
    providerIcon={controller.providerIcon}
    on:refresh={controller.refreshAuthPairState}
    on:logout={controller.logout}
    on:opencredential={() => controller.openCredentialModal({ mode: "signin" })}
    on:openprofile={() => controller.openProfileModal({ keepMessages: true })}
    on:joincodeinput={(event) => controller.setJoinCode(event.detail)}
    on:joinroom={controller.joinPairCode}
    on:createroom={() => controller.createPairCode()}
    on:toggledetails={controller.toggleDetails}
    on:copylink={controller.copyRoomLink}
    on:reconnect={controller.reconnectCurrentRoom}
    on:openwizard={() => dispatch("openwizard")}
  />
</ModalShell>

<AuthCredentialModal
  open={credentialModalOpen}
  busy={authBusy}
  mode={credentialMode}
  username={loginUsername}
  password={loginPassword}
  passwordConfirm={loginPasswordConfirm}
  pendingAutoPairAfterAuth={pendingAutoPairAfterAuth}
  errorText={errorText}
  infoText={infoText}
  on:close={controller.closeCredentialModal}
  on:submit={controller.submitCredentialAuth}
  on:modechange={(event) => controller.setCredentialMode(event.detail)}
  on:togglemode={controller.toggleCredentialMode}
  on:usernameinput={(event) => controller.setLoginUsername(event.detail)}
  on:passwordinput={(event) => controller.setLoginPassword(event.detail)}
  on:passwordconfirminput={(event) => controller.setLoginPasswordConfirm(event.detail)}
/>

<AuthProfileModal
  open={profileModalOpen}
  busy={profileBusy}
  draft={profileDraft}
  avatarPreview={profileAvatarPreview}
  errorText={errorText}
  infoText={infoText}
  on:close={controller.closeProfileModal}
  on:submit={controller.saveMyProfile}
  on:usedefaultavatar={controller.useDefaultAvatar}
  on:draftchange={(event) => controller.updateProfileDraft(event.detail?.field, event.detail?.value)}
  on:avatarfilechange={(event) => controller.onProfileAvatarFile(event.detail)}
  on:avatarerror={(event) => controller.onProfileImageError(event.detail)}
/>

{#if showProviderLogin}
  <AuthProviderPickerModal
    open={providerPickerOpen}
    authBusy={authBusy}
    pairBusy={pairBusy}
    providers={providers}
    pendingAutoPairAfterAuth={pendingAutoPairAfterAuth}
    providerPickerReason={providerPickerReason}
    providerName={controller.providerName}
    providerIcon={controller.providerIcon}
    providerHint={controller.providerHint}
    providerAccent={controller.providerAccent}
    on:close={controller.closeProviderPicker}
    on:chooseprovider={(event) => controller.startAuthLogin(event.detail)}
  />
{/if}


