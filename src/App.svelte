<script>
  import { onDestroy, onMount, tick } from "svelte";
  import TimerSection from "./lib/components/TimerSection.svelte";
  import NextMilestoneSection from "./lib/components/NextMilestoneSection.svelte";
  import ProfilesSection from "./lib/components/ProfilesSection.svelte";
  import MilestonesSection from "./lib/components/MilestonesSection.svelte";
  import GalleryTogetherSection from "./lib/components/GalleryTogetherSection.svelte";
  import EventsSection from "./lib/components/EventsSection.svelte";
  import AuthPairingPanel from "./lib/components/AuthPairingPanel.svelte";
  import AmbientLayer from "./lib/components/AmbientLayer.svelte";
  import ToastMessage from "./lib/components/ToastMessage.svelte";
  import SettingsModal from "./lib/components/SettingsModal.svelte";
  import WizardModal from "./lib/components/WizardModal.svelte";
  import MilestoneCelebrationModal from "./lib/components/MilestoneCelebrationModal.svelte";
  import PrivacyPolicyPage from "./lib/components/PrivacyPolicyPage.svelte";
  import PwaInstallButton from "./lib/components/PwaInstallButton.svelte";
  import { buildMilestoneView, parseDateTime } from "./lib/lingo/utils.js";
  import {
    destroyLingoSharedStateBridge,
    initLingoSharedStateBridge,
    lingoActions,
    lingoMeta,
    lingoNow,
    lingoState,
  } from "./lib/lingo/store.js";

  let settingsOpen = false;
  let wizardOpen = false;
  let wizardRequired = false;
  let pairingOpen = false;
  let toastOpen = false;
  let toastMessage = "";
  let toastTimer;
  let celebrationQueue = [];
  let activeCelebration = null;
  let initFailedNotified = false;
  let authPairingPanelRef;
  let currentPath = "/";
  let removePopstateListener = () => {};
  let lastAutoPromptRoomId = "";
  let pairingAutoPrompted = false;
  let authStateLoading = true;
  let isAuthenticated = false;

  function showToast(message, ms = 2200) {
    toastMessage = message;
    toastOpen = true;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastOpen = false;
    }, ms);
  }

  function openSettings() {
    settingsOpen = true;
  }

  function openPairing() {
    pairingOpen = true;
  }

  function closePairing() {
    pairingOpen = false;
  }

  function handleAuthState(event) {
    const detail = event?.detail || {};
    authStateLoading = !!detail.loading;
    isAuthenticated = !!detail.authenticated;
  }

  function openImportFlow() {
    pairingOpen = false;
    settingsOpen = true;
    showToast("Mở Cài đặt để nhập bản sao lưu JSON.");
  }

  function openWizard(forceRequired = false) {
    pairingOpen = false;
    wizardRequired = forceRequired || !($lingoState?.settings?.startDate || "").trim();
    wizardOpen = true;
  }

  function closeWizard() {
    wizardOpen = false;
  }

  function closeSettings() {
    settingsOpen = false;
  }

  function clearCelebrationState() {
    celebrationQueue = [];
    activeCelebration = null;
  }

  function updateCurrentPath() {
    if (typeof window === "undefined") {
      currentPath = "/";
      return;
    }
    currentPath = window.location.pathname || "/";
  }

  function stripEmptyHash() {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#") return;
    const cleanPath = `${window.location.pathname || "/"}${window.location.search || ""}`;
    history.replaceState({}, "", cleanPath);
  }

  async function reconnectRoom(roomId = "", options = {}) {
    try {
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        const nextRoom = String(roomId || "").trim();
        if (nextRoom) {
          url.searchParams.set("room", nextRoom);
          url.searchParams.delete("code");
        } else if (options.clearRoomQuery) {
          url.searchParams.delete("room");
          url.searchParams.delete("code");
        }
        history.replaceState({}, "", url);
        stripEmptyHash();
      }

      destroyLingoSharedStateBridge();
      await initLingoSharedStateBridge();

      if (roomId) showToast(`Đã kết nối phòng ${roomId}.`);
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Không thể kết nối lại dữ liệu của cặp đôi.");
    }
  }

  async function closeCelebration() {
    if (!activeCelebration) return;
    try {
      await lingoActions.markMilestoneCelebrationShown(activeCelebration.id);
      activeCelebration = null;
    } catch (err) {
      showToast(err?.message || "Không thể lưu trạng thái cột mốc.");
    }
  }

  async function handleWizardComplete() {
    wizardRequired = false;
    wizardOpen = false;
    await tick();
    try {
      await authPairingPanelRef?.handleWizardCompletedAutoPair?.();
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Không thể tự tạo mã ghép cặp sau Wizard.");
    }
  }

  onMount(() => {
    stripEmptyHash();
    updateCurrentPath();

    if (typeof window !== "undefined") {
      const onPopstate = () => updateCurrentPath();
      window.addEventListener("popstate", onPopstate);
      removePopstateListener = () => window.removeEventListener("popstate", onPopstate);
    }

    if (currentPath === "/privacy" || currentPath === "/privacy/") return;

    initLingoSharedStateBridge().catch((err) => {
      console.error(err);
      if (initFailedNotified) return;
      initFailedNotified = true;
      showToast(err?.message || "Không thể kết nối dữ liệu.");
    });
  });

  onDestroy(() => {
    clearTimeout(toastTimer);
    removePopstateListener?.();
    destroyLingoSharedStateBridge();
  });

  $: isPrivacyRoute = currentPath === "/privacy" || currentPath === "/privacy/";
  $: hasStartDate = !!($lingoState?.settings?.startDate || "").trim();
  $: roomId = String($lingoMeta?.roomId || "").trim();
  $: hasRoom = !!roomId;
  $: syncReady = !!$lingoMeta?.ready;
  $: syncStatus = $lingoMeta?.status || "connecting";
  $: canPromptWizard = syncReady && syncStatus !== "error";
  $: canShowMainContent = hasRoom;
  $: showSetupChoice = hasRoom && !hasStartDate;
  $: authPanelMode = $lingoState?.ui?.authPanelMode === "standard" ? "standard" : "ultra_minimal";

  $: celebrationStart = parseDateTime($lingoState?.settings?.startDate || "");
  $: celebrationView = buildMilestoneView(celebrationStart, new Date($lingoNow));
  $: shownMilestoneIds = Array.isArray($lingoState?.celebrations?.shownMilestoneIds)
    ? $lingoState.celebrations.shownMilestoneIds
    : [];

  $: if (!hasRoom) {
    lastAutoPromptRoomId = "";
  }

  $: if (hasRoom) {
    pairingAutoPrompted = false;
  }

  $: if (!hasRoom && canPromptWizard && !pairingAutoPrompted && !pairingOpen && !wizardOpen && !settingsOpen) {
    pairingAutoPrompted = true;
    pairingOpen = true;
    showToast("Mở kết nối cặp đôi để tạo hoặc tham gia phòng chung.");
  }

  $: if (hasRoom && canPromptWizard && !hasStartDate && roomId !== lastAutoPromptRoomId) {
    lastAutoPromptRoomId = roomId;
    wizardRequired = true;
    wizardOpen = true;
    showToast("Bắt đầu với Wizard để thiết lập cặp đôi.");
  }

  $: if (!isPrivacyRoute && !authStateLoading && !isAuthenticated && !pairingOpen && !wizardOpen && !settingsOpen) {
    pairingOpen = true;
  }

  $: if (!hasStartDate && (celebrationQueue.length || activeCelebration)) {
    clearCelebrationState();
  }

  $: {
    const achieved = hasStartDate ? (celebrationView?.items?.filter((m) => m.achieved) || []) : [];
    if (achieved.length) {
      const shownSet = new Set(shownMilestoneIds);
      const queuedSet = new Set(celebrationQueue.map((m) => m.id));
      const activeId = activeCelebration?.id || "";
      const toQueue = achieved.filter((m) => !shownSet.has(m.id) && !queuedSet.has(m.id) && m.id !== activeId);
      if (toQueue.length) celebrationQueue = [...celebrationQueue, ...toQueue];
    }
  }

  $: if (!activeCelebration && celebrationQueue.length && !settingsOpen && !wizardOpen && hasStartDate) {
    activeCelebration = celebrationQueue[0];
    celebrationQueue = celebrationQueue.slice(1);
  }

  $: if (activeCelebration && shownMilestoneIds.includes(activeCelebration.id)) {
    activeCelebration = null;
  }
</script>

<a href="#mainContent" class="skip-link">Bỏ qua đến nội dung chính</a>
<noscript>
  <div
    style="position:sticky;top:0;z-index:70;background:#fff8fc;border-bottom:1px solid rgba(255,184,216,.5);padding:10px 14px;font:600 14px/1.4 'Be Vietnam Pro',sans-serif;color:#5e4d57;"
  >
    Trang web này cần JavaScript để chạy bộ đếm thời gian thực, cột mốc và lưu dữ liệu.
  </div>
</noscript>

<AmbientLayer />

{#if isPrivacyRoute}
  <PrivacyPolicyPage />
{:else}
  <main id="mainContent" tabindex="-1" class="relative z-10 px-4 py-4 sm:px-6 lg:px-8">
    <div class="mx-auto max-w-6xl space-y-4">
      <header class="card rounded-3xl p-4 sm:p-5">
        <div class="flex min-w-0 items-start justify-between gap-4">
          <div class="flex min-w-0 items-start gap-4">
            <div class="h-14 w-14 rounded-2xl bg-white/70 border border-white/80 shadow-sm shadow-pink-200/40 overflow-hidden p-1">
              <img
                src="/logos/lingo-icon.svg?v=20260227"
                alt="Logo Lingo"
                class="h-full w-full object-contain"
                loading="eager"
                decoding="async"
              />
            </div>
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-[.18em] text-pink-500/80">Lingo</p>
              <h1 class="text-xl sm:text-2xl font-extrabold leading-tight text-[color:var(--ink)]">Bộ đếm ngày yêu Hồng Hạc</h1>
              <p class="mt-1 text-sm text-[color:var(--ink2)]">
                Tình yêu bền vững như loài Hạc (chung thủy trọn đời) và rực rỡ như hoa Tulip (tình yêu hoàn hảo).
              </p>
            </div>
          </div>
          <div class="hidden shrink-0 sm:block">
            <PwaInstallButton buttonClass="btn btn-soft text-sm whitespace-nowrap" label="Cài ứng dụng" compact={true} on:toast={(e) => showToast(e.detail)} />
          </div>
        </div>
        <div class="mt-3 sm:hidden">
          <PwaInstallButton buttonClass="btn btn-soft text-sm w-full" label="Cài ứng dụng" compact={true} on:toast={(e) => showToast(e.detail)} />
        </div>
      </header>
      <div class="pinterest-board">
        {#if showSetupChoice}
          <section class="pinterest-tile card rounded-3xl p-4 sm:p-5">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Bắt đầu thiết lập</p>
                <h2 class="text-lg sm:text-xl font-bold text-[color:var(--ink)]">Wizard hoặc nhập bản sao lưu</h2>
                <p class="text-sm text-[color:var(--ink2)]">
                  Bạn có thể nhập nhanh bằng Wizard hoặc khôi phục dữ liệu cũ bằng file JSON.
                </p>
              </div>
              <div class="grid grid-cols-1 gap-2 w-full sm:w-auto sm:min-w-[260px]">
                <button class="btn btn-primary text-sm w-full" type="button" on:click={() => openWizard(true)}>Mở Wizard</button>
                <button class="btn btn-soft text-sm w-full" type="button" on:click={openImportFlow}>Nhập JSON</button>
              </div>
            </div>
          </section>
        {/if}

        {#if canShowMainContent}
          <div class="pinterest-tile lg:hidden">
            <section class="card rounded-3xl p-3 sm:p-4" aria-label="Kết nối & cài đặt">
              <div class="mb-3">
                <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Điều khiển nhanh</p>
                <h3 class="text-base font-bold leading-tight text-[color:var(--ink)]">Kết nối & cài đặt</h3>
              </div>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  class={`btn text-sm w-full ${hasRoom ? "btn-soft" : "btn-primary"}`}
                  type="button"
                  on:click={openPairing}
                >
                  {hasRoom ? `Phòng ${roomId}` : "Kết nối cặp đôi"}
                </button>
                <button class="btn btn-soft text-sm w-full" type="button" on:click={openSettings}>Cài đặt</button>
                <button class="btn btn-primary text-sm w-full" type="button" on:click={() => openWizard(false)}>Wizard nhanh</button>
                <PwaInstallButton buttonClass="btn btn-soft text-sm w-full" label="Cài ứng dụng" compact={true} on:toast={(e) => showToast(e.detail)} />
              </div>
            </section>
          </div>

          <div class="pinterest-tile">
            <TimerSection state={$lingoState} now={$lingoNow} />
          </div>

          <div class="pinterest-tile">
            <NextMilestoneSection state={$lingoState} now={$lingoNow} />
          </div>

          <div class="pinterest-tile">
            <ProfilesSection state={$lingoState} meta={$lingoMeta} now={$lingoNow} on:quickedit={openSettings} />
          </div>

          <div class="pinterest-tile">
            <MilestonesSection state={$lingoState} now={$lingoNow} />
          </div>

          <div class="pinterest-tile">
            <GalleryTogetherSection on:toast={(e) => showToast(e.detail)} />
          </div>

          <div class="pinterest-tile space-y-4">
            <section class="card rounded-3xl p-3 sm:p-4 hidden lg:block" aria-label="Kết nối & cài đặt">
              <div class="mb-3">
                <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Điều khiển nhanh</p>
                <h3 class="text-base font-bold leading-tight text-[color:var(--ink)]">Kết nối & cài đặt</h3>
              </div>
              <div class="grid grid-cols-1 gap-2">
                <button
                  class={`btn text-sm w-full ${hasRoom ? "btn-soft" : "btn-primary"}`}
                  type="button"
                  on:click={openPairing}
                >
                  {hasRoom ? `Phòng ${roomId}` : "Kết nối cặp đôi"}
                </button>
                <button class="btn btn-soft text-sm w-full" type="button" on:click={openSettings}>Cài đặt</button>
                <button class="btn btn-primary text-sm w-full" type="button" on:click={() => openWizard(false)}>Wizard nhanh</button>
                <PwaInstallButton buttonClass="btn btn-soft text-sm w-full" label="Cài ứng dụng" compact={true} on:toast={(e) => showToast(e.detail)} />
              </div>
            </section>

            <EventsSection
              state={$lingoState}
              now={$lingoNow}
              actions={lingoActions}
            />
          </div>
        {/if}

        <footer class="pinterest-tile card rounded-2xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="text-sm text-[color:var(--ink2)]">
            <p class="font-semibold text-[color:var(--ink)]">Riêng tư & cài đặt</p>
            <p>Dữ liệu được lưu trong phòng chung của hai bạn và đồng bộ giữa các thiết bị đã ghép cặp.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <PwaInstallButton buttonClass="btn btn-soft text-sm" label="Cài ứng dụng" on:toast={(e) => showToast(e.detail)} />
            <button class="btn btn-soft text-sm" type="button" on:click={openSettings}>Mở cài đặt</button>
            <button class="btn btn-primary text-sm" type="button" on:click={() => openWizard(false)}>Wizard nhanh</button>
          </div>
        </footer>
      </div>
    </div>
  </main>

  <AuthPairingPanel
    bind:this={authPairingPanelRef}
    open={pairingOpen}
    currentRoomId={roomId}
    syncStatus={syncStatus}
    hasStartDate={hasStartDate}
    ultraMinimal={authPanelMode === "ultra_minimal"}
    on:close={closePairing}
    on:toast={(e) => showToast(e.detail)}
    on:openwizard={() => openWizard(!hasStartDate)}
    on:openimport={openImportFlow}
    on:authstate={handleAuthState}
    on:refreshroom={(e) => reconnectRoom("", { clearRoomQuery: !!e.detail?.clearRoomQuery })}
    on:roomconnect={(e) => {
      closePairing();
      reconnectRoom(e.detail?.roomId || e.detail?.code || "");
    }}
  />

  <SettingsModal
    open={settingsOpen}
    state={$lingoState}
    actions={lingoActions}
    toast={showToast}
    on:close={closeSettings}
    on:saved={() => {
      settingsOpen = false;
    }}
    on:reset={() => {
      settingsOpen = false;
      wizardRequired = true;
      wizardOpen = false;
      clearCelebrationState();
      showToast("Dữ liệu đã đặt lại. Hãy dùng Wizard hoặc nhập JSON để bắt đầu lại.");
    }}
  />

  <WizardModal
    open={wizardOpen}
    required={wizardRequired}
    state={$lingoState}
    actions={lingoActions}
    toast={showToast}
    on:close={closeWizard}
    on:complete={handleWizardComplete}
  />

  <MilestoneCelebrationModal
    open={!!activeCelebration}
    milestone={activeCelebration}
    queueCount={celebrationQueue.length}
    on:close={closeCelebration}
  />
{/if}

<ToastMessage message={toastMessage} open={toastOpen} />

<style>
  .pinterest-board {
    position: relative;
  }

  .pinterest-tile {
    margin-bottom: 1rem;
    break-inside: avoid;
    -webkit-column-break-inside: avoid;
    page-break-inside: avoid;
  }

  @media (min-width: 1024px) {
    .pinterest-board {
      column-count: 2;
      column-gap: 1rem;
      column-fill: balance;
    }
  }
</style>
