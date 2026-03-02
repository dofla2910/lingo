<script>
  import { get } from "svelte/store";
  import { onDestroy, onMount } from "svelte";
  import TimerSection from "./lib/components/TimerSection.svelte";
  import NextMilestoneSection from "./lib/components/NextMilestoneSection.svelte";
  import ProfilesSection from "./lib/components/ProfilesSection.svelte";
  import MilestonesSection from "./lib/components/MilestonesSection.svelte";
  import GalleryTogetherSection from "./lib/components/GalleryTogetherSection.svelte";
  import TimeCapsuleSection from "./lib/components/TimeCapsuleSection.svelte";
  import HeartbeatSection from "./lib/components/HeartbeatSection.svelte";
  import HeartRain from "./lib/components/HeartRain.svelte";
  import EventsSection from "./lib/components/EventsSection.svelte";
  import AuthPairingPanel from "./lib/components/AuthPairingPanel.svelte";
  import AmbientLayer from "./lib/components/AmbientLayer.svelte";
  import ToastMessage from "./lib/components/ToastMessage.svelte";
  import SettingsModal from "./lib/components/SettingsModal.svelte";
  import WizardModal from "./lib/components/WizardModal.svelte";
  import MilestoneCelebrationModal from "./lib/components/MilestoneCelebrationModal.svelte";
  import PrivacyPolicyPage from "./lib/components/PrivacyPolicyPage.svelte";
  import AppHeaderCard from "./lib/components/AppHeaderCard.svelte";
  import SetupWizardCard from "./lib/components/SetupWizardCard.svelte";
  import QuickActionsCard from "./lib/components/QuickActionsCard.svelte";
  import AppFooterCard from "./lib/components/AppFooterCard.svelte";
  import AppBootstrapSkeleton from "./lib/components/AppBootstrapSkeleton.svelte";
  import AppBootstrapTimeoutCard from "./lib/components/AppBootstrapTimeoutCard.svelte";
  import { createPingController } from "./lib/lingo/pingController.js";
  import { showPingNotification } from "./lib/lingo/pingNotifications.js";
  import { createAppShellController } from "./lib/lingo/appShellController.js";
  import {
    destroyLingoSharedStateBridge,
    initLingoSharedStateBridge,
    lingoActions,
    lingoMeta,
    lingoNow,
    lingoPing,
    lingoPingStats,
    lingoState,
  } from "./lib/lingo/store.js";

  let toastOpen = false;
  let toastMessage = "";
  let toastTimer;
  let authPairingPanelRef;
  let heartRainRef;
  let retryBootstrapBusy = false;
  let pingBusy = false;

  function showToast(message, ms = 2200) {
    toastMessage = message;
    toastOpen = true;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastOpen = false;
    }, ms);
  }

  async function handleRetryBootstrap() {
    if (retryBootstrapBusy) return;
    retryBootstrapBusy = true;
    try {
      await shell.retryBootstrap();
    } finally {
      retryBootstrapBusy = false;
    }
  }

  const shell = createAppShellController({
    lingoState,
    lingoMeta,
    lingoNow,
    lingoActions,
    initBridge: initLingoSharedStateBridge,
    destroyBridge: destroyLingoSharedStateBridge,
    toast: showToast,
  });

  const uiState = shell.uiState;
  const viewModel = shell.viewModel;
  const celebrationState = shell.celebrationState;

  const pingController = createPingController({
    getViewSnapshot: () => get(viewModel),
    getMetaSnapshot: () => get(lingoMeta),
    sendPingAction: (roomId, myUserId) => lingoActions.sendPing(roomId, myUserId),
    onToast: showToast,
    showPingNotification,
    getHeartRainRef: () => heartRainRef,
    onBusyChange: (next) => {
      pingBusy = !!next;
    },
  });

  function handleSendPing() {
    return pingController.sendPing();
  }

  onMount(() => {
    shell.mount();
    pingController.mount();
  });

  onDestroy(() => {
    clearTimeout(toastTimer);
    pingController.destroy();
    shell.destroy();
  });

  $: pingController.handleIncomingPingIfNew($lingoPing);
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
<HeartRain bind:this={heartRainRef} />

{#if $viewModel.isPrivacyRoute}
  <PrivacyPolicyPage />
{:else}
  <main id="mainContent" tabindex="-1" class="relative z-10 px-3 py-3 sm:px-5 sm:py-4 lg:px-7 xl:px-8">
    <div class="app-shell mx-auto flex max-w-6xl flex-col gap-4">
      <AppHeaderCard on:toast={(e) => showToast(e.detail)} />
      <div class="pinterest-board">
        {#if $viewModel.showAppLoading}
          {#if $viewModel.bootstrapTimedOut}
            <AppBootstrapTimeoutCard
              busy={retryBootstrapBusy}
              on:retry={handleRetryBootstrap}
              on:openpairing={shell.openPairing}
            />
          {:else}
            <AppBootstrapSkeleton />
          {/if}
        {:else}
          {#if $viewModel.showSetupChoice}
            <div class="pinterest-tile">
              <SetupWizardCard on:openwizard={() => shell.openWizard(true)} />
            </div>
          {/if}

          {#if $viewModel.canShowMainContent}
            <div class="pinterest-tile lg:hidden">
              <QuickActionsCard
                hasRoom={$viewModel.hasRoom}
                roomId={$viewModel.roomId}
                twoColumn={true}
                on:openpairing={shell.openPairing}
                on:opensettings={shell.openSettings}
                on:openwizard={() => shell.openWizard(false)}
                on:toast={(e) => showToast(e.detail)}
              />
            </div>

            <div class="pinterest-tile">
              <HeartbeatSection
                hasRoom={$viewModel.hasRoom}
                roomId={$viewModel.roomId}
                pingBusy={pingBusy}
                stats={$lingoPingStats}
                on:ping={handleSendPing}
              />
            </div>

            <div class="pinterest-tile">
              <TimerSection state={$lingoState} now={$lingoNow} />
            </div>

            <div class="pinterest-tile">
              <NextMilestoneSection state={$lingoState} now={$lingoNow} />
            </div>

            <div class="pinterest-tile">
              <ProfilesSection
                state={$lingoState}
                meta={$lingoMeta}
                now={$lingoNow}
                on:quickedit={() => shell.openWizard(false)}
              />
            </div>

            <div class="pinterest-tile">
              <MilestonesSection state={$lingoState} now={$lingoNow} />
            </div>

            <div class="pinterest-tile">
              <GalleryTogetherSection on:toast={(e) => showToast(e.detail)} />
            </div>

            <div class="pinterest-tile">
              <TimeCapsuleSection roomId={$viewModel.roomId} on:toast={(e) => showToast(e.detail)} />
            </div>

            <div class="pinterest-tile">
              <div class="hidden lg:block">
                <QuickActionsCard
                  hasRoom={$viewModel.hasRoom}
                  roomId={$viewModel.roomId}
                  on:openpairing={shell.openPairing}
                  on:opensettings={shell.openSettings}
                  on:openwizard={() => shell.openWizard(false)}
                  on:toast={(e) => showToast(e.detail)}
                />
              </div>

              <EventsSection
                state={$lingoState}
                now={$lingoNow}
                actions={lingoActions}
              />
            </div>
          {/if}

          <div class="pinterest-tile">
            <AppFooterCard
              on:opensettings={shell.openSettings}
              on:openwizard={() => shell.openWizard(false)}
              on:toast={(e) => showToast(e.detail)}
            />
          </div>
        {/if}
      </div>
    </div>
  </main>

  <AuthPairingPanel
    bind:this={authPairingPanelRef}
    open={$uiState.pairingOpen}
    currentRoomId={$viewModel.roomId}
    syncStatus={$viewModel.syncStatus}
    hasStartDate={$viewModel.hasStartDate}
    ultraMinimal={$viewModel.authPanelMode === "ultra_minimal"}
    on:close={shell.closePairing}
    on:toast={(e) => showToast(e.detail)}
    on:openwizard={() => shell.openWizard(!$viewModel.hasStartDate)}
    on:authstate={(e) => shell.setAuthState(e.detail)}
    on:refreshroom={(e) => shell.reconnectRoom("", { clearRoomQuery: !!e.detail?.clearRoomQuery })}
    on:roomconnect={(e) => {
      shell.closePairing();
      shell.reconnectRoom(e.detail?.roomId || e.detail?.code || "");
    }}
  />

  <SettingsModal
    open={$uiState.settingsOpen}
    state={$lingoState}
    actions={lingoActions}
    toast={showToast}
    on:close={shell.closeSettings}
    on:saved={shell.closeSettings}
  />

  <WizardModal
    open={$uiState.wizardOpen}
    required={$uiState.wizardRequired}
    state={$lingoState}
    actions={lingoActions}
    toast={showToast}
    on:close={shell.closeWizard}
    on:complete={() => shell.handleWizardComplete(authPairingPanelRef)}
  />

  <MilestoneCelebrationModal
    open={!!$celebrationState.active}
    milestone={$celebrationState.active}
    queueCount={$celebrationState.queue.length}
    on:close={shell.closeCelebration}
  />
{/if}

<ToastMessage message={toastMessage} open={toastOpen} />

<style>
  .app-shell {
    gap: clamp(0.75rem, 1.6vw, 1rem);
  }

  .pinterest-board {
    position: relative;
    column-count: 1;
    column-gap: clamp(0.75rem, 1.8vw, 1rem);
    column-fill: balance;
  }

  .pinterest-tile {
    margin-bottom: clamp(0.75rem, 1.8vw, 1rem);
    break-inside: avoid;
    -webkit-column-break-inside: avoid;
    page-break-inside: avoid;
  }

  @media (min-width: 860px) {
    .pinterest-board {
      column-count: 2;
    }
  }
</style>
