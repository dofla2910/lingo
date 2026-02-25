<script>
  import { onDestroy, onMount, tick } from "svelte";
  import TimerSection from "./lib/components/TimerSection.svelte";
  import ProfilesSection from "./lib/components/ProfilesSection.svelte";
  import MilestonesSection from "./lib/components/MilestonesSection.svelte";
  import EventsSection from "./lib/components/EventsSection.svelte";
  import AuthPairingPanel from "./lib/components/AuthPairingPanel.svelte";
  import AmbientLayer from "./lib/components/AmbientLayer.svelte";
  import ToastMessage from "./lib/components/ToastMessage.svelte";
  import SettingsModal from "./lib/components/SettingsModal.svelte";
  import WizardModal from "./lib/components/WizardModal.svelte";
  import MilestoneCelebrationModal from "./lib/components/MilestoneCelebrationModal.svelte";
  import PrivacyPolicyPage from "./lib/components/PrivacyPolicyPage.svelte";
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
  let toastOpen = false;
  let toastMessage = "";
  let toastTimer;
  let prevHasStart = null;
  let celebrationQueue = [];
  let activeCelebration = null;
  let initFailedNotified = false;
  let authPairingPanelRef;
  let currentPath = "/";
  let removePopstateListener = () => {};

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

  function openWizard(forceRequired = false) {
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

  async function reconnectFirebaseRoom(roomId = "", options = {}) {
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
      }
      destroyLingoSharedStateBridge();
      await initLingoSharedStateBridge();
      if (roomId) showToast(`Đã kết nối phòng ${roomId}.`);
    } catch (err) {
      console.error(err);
      showToast(err?.message || "Không thể kết nối lại phòng Firebase.");
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
      showToast(err?.message || "Không thể kết nối Firebase.");
    });
  });

  onDestroy(() => {
    clearTimeout(toastTimer);
    removePopstateListener?.();
    destroyLingoSharedStateBridge();
  });

  $: isPrivacyRoute = currentPath === "/privacy" || currentPath === "/privacy/";
  $: hasStartDate = !!($lingoState?.settings?.startDate || "").trim();
  $: firebaseReady = !!$lingoMeta?.ready;
  $: firebaseStatus = $lingoMeta?.status || "connecting";
  $: canPromptWizard = firebaseReady && firebaseStatus !== "error";
  $: celebrationStart = parseDateTime($lingoState?.settings?.startDate || "");
  $: celebrationView = buildMilestoneView(celebrationStart, new Date($lingoNow));
  $: shownMilestoneIds = Array.isArray($lingoState?.celebrations?.shownMilestoneIds)
    ? $lingoState.celebrations.shownMilestoneIds
    : [];
  $: if (!canPromptWizard) {
    prevHasStart = null;
  } else if (prevHasStart === null) {
    prevHasStart = hasStartDate;
    if (!hasStartDate) {
      wizardRequired = true;
      wizardOpen = true;
      showToast("Bắt đầu với Wizard để thiết lập cặp đôi.");
    }
  } else if (prevHasStart !== hasStartDate) {
    if (!hasStartDate) {
      wizardRequired = true;
      wizardOpen = true;
    } else {
      wizardRequired = false;
    }
    prevHasStart = hasStartDate;
  }

  $: if (!hasStartDate) {
    if (celebrationQueue.length || activeCelebration) clearCelebrationState();
  }

  $: {
    const achieved = celebrationView?.items?.filter((m) => m.achieved) || [];
    if (!achieved.length) {
      // no-op
    } else {
      const shownSet = new Set(shownMilestoneIds);
      const queuedSet = new Set(celebrationQueue.map((m) => m.id));
      const activeId = activeCelebration?.id || "";
      const toQueue = achieved.filter((m) => !shownSet.has(m.id) && !queuedSet.has(m.id) && m.id !== activeId);
      if (toQueue.length) {
        celebrationQueue = [...celebrationQueue, ...toQueue];
      }
    }
  }

  $: if (
    !activeCelebration &&
    celebrationQueue.length &&
    !settingsOpen &&
    !wizardOpen
  ) {
    activeCelebration = celebrationQueue[0];
    celebrationQueue = celebrationQueue.slice(1);
  }

  $: if (activeCelebration && shownMilestoneIds.includes(activeCelebration.id)) {
    activeCelebration = null;
  }
</script>

<a href="#mainContent" class="skip-link">Bỏ qua đến nội dung chính</a>
<noscript>
  <div style="position:sticky;top:0;z-index:70;background:#fff8fc;border-bottom:1px solid rgba(255,184,216,.5);padding:10px 14px;font:600 14px/1.4 'Be Vietnam Pro',sans-serif;color:#5e4d57;">
    Trang web này cần JavaScript để chạy bộ đếm thời gian thực, cột mốc và lưu dữ liệu local.
  </div>
</noscript>

<AmbientLayer />

{#if isPrivacyRoute}
  <PrivacyPolicyPage />
{:else}
<main id="mainContent" tabindex="-1" class="relative z-10 px-4 py-4 sm:px-6 lg:px-8">
  <div class="mx-auto max-w-6xl space-y-4">
    <section class="card rounded-3xl p-4 sm:p-5">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="flex items-start gap-4">
          <div class="h-14 w-14 rounded-2xl flex items-center justify-center bg-white/70 border border-white/80 shadow-sm shadow-pink-200/40">
            <span class="text-2xl" aria-hidden="true">🦩</span>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-[.18em] text-pink-500/80">Lingo</p>
            <h1 class="text-xl sm:text-2xl font-extrabold text-[color:var(--ink)]">Bộ đếm ngày yêu Lingo</h1>
            <p class="text-sm text-[color:var(--ink2)]">
              Tình yêu bền vững như loài Hạc (chung thủy trọn đời) và rực rỡ như hoa Tulip (tình yêu hoàn hảo).
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-soft text-sm" type="button" on:click={openSettings}>Cài đặt</button>
          <button class="btn btn-primary text-sm" type="button" on:click={() => openWizard(false)}>Wizard nhanh</button>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
        <span class="pill">
          {firebaseStatus === "synced" ? "☁️ Firebase: đã đồng bộ" : firebaseStatus === "saving" ? "☁️ Firebase: đang lưu..." : firebaseStatus === "error" ? "☁️ Firebase: lỗi kết nối" : "☁️ Firebase: đang kết nối..."}
        </span>
        {#if $lingoMeta?.roomId}
          <span class="pill">Phòng: {$lingoMeta.roomId}</span>
        {/if}
      </div>
      {#if $lingoMeta?.error}
        <p class="mt-2 text-sm font-medium text-rose-600">{$lingoMeta.error}</p>
      {/if}
    </section>

    <AuthPairingPanel
      bind:this={authPairingPanelRef}
      currentRoomId={$lingoMeta?.roomId || ""}
      firebaseStatus={firebaseStatus}
      hasStartDate={hasStartDate}
      on:toast={(e) => showToast(e.detail)}
      on:openwizard={() => openWizard(!hasStartDate)}
      on:refreshfirebase={() => reconnectFirebaseRoom("", { clearRoomQuery: false })}
      on:roomconnect={(e) => reconnectFirebaseRoom(e.detail?.roomId || e.detail?.code || "")}
    />

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div class="xl:col-span-5">
        <TimerSection state={$lingoState} now={$lingoNow} />
      </div>
      <div class="xl:col-span-7">
        <MilestonesSection state={$lingoState} now={$lingoNow} />
      </div>
    </div>

    <ProfilesSection state={$lingoState} now={$lingoNow} />
    <EventsSection state={$lingoState} now={$lingoNow} actions={lingoActions} />

    <section class="card rounded-2xl p-4 text-sm text-[color:var(--ink2)]">
      <p class="font-semibold text-[color:var(--ink)]">Riêng tư & cài đặt</p>
      <p class="mt-1">
        Dữ liệu hiện được lưu trực tiếp trên <code>Firebase Realtime Database</code>. Wizard, Cài đặt và chúc mừng cột mốc đã chuyển sang Svelte.
      </p>
      <div class="mt-3">
        <a href="/privacy" class="btn btn-soft text-sm">Chính sách bảo mật</a>
      </div>
    </section>
  </div>
</main>

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
    wizardOpen = true;
    clearCelebrationState();
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
