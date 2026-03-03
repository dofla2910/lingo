<script>
  import { createEventDispatcher, onMount } from "svelte";
  import PwaIosGuideModal from "./PwaIosGuideModal.svelte";
  import {
    closeIOSGuide,
    pwaState,
    requestPwaInstall,
    requestPwaUpdate,
  } from "$lib/lingo/pwaController.js";

  export let buttonClass = "btn btn-soft text-sm";
  export let label = "Cài ứng dụng";
  export let compact = false;

  const dispatch = createEventDispatcher();

  $: showInstallButton = !$pwaState.isStandalone && ($pwaState.canInstallPrompt || $pwaState.isIOS);
  $: showUpdateButton = $pwaState.isStandalone || !!$pwaState.updateAvailable || !!$pwaState.updating;
  $: updateLabel = $pwaState.updating
    ? "Đang cập nhật..."
    : $pwaState.updateAvailable
      ? "Cập nhật ứng dụng"
      : "Kiểm tra cập nhật";

  async function requestInstall() {
    const result = await requestPwaInstall();
    if (result?.status === "accepted") {
      dispatch("toast", "Đang cài ứng dụng Lingo vào màn hình chính.");
      return;
    }
    if (result?.status === "unsupported") {
      dispatch("toast", "Thiết bị/trình duyệt hiện tại chưa hỗ trợ cài ứng dụng.");
    }
  }

  async function requestUpdate() {
    const result = await requestPwaUpdate();

    if (result?.status === "updating") {
      dispatch("toast", "Đang cập nhật ứng dụng lên phiên bản mới.");
      return;
    }

    if (result?.status === "up_to_date") {
      dispatch("toast", "Ứng dụng đã ở phiên bản mới nhất.");
      return;
    }

    if (result?.status === "unsupported") {
      dispatch("toast", "Thiết bị hiện chưa hỗ trợ cập nhật tự động.");
      return;
    }

    if (result?.status === "error") {
      dispatch("toast", "Không thể cập nhật ngay bây giờ. Vui lòng thử lại.");
    }
  }

  function handleInstalled() {
    dispatch("toast", "Đã cài ứng dụng thành công.");
    dispatch("installed");
  }

  // Install-complete signal comes from global appinstalled event and reflected in store.
  let installedWasStandalone = false;
  onMount(() => {
    installedWasStandalone = !!$pwaState.isStandalone;
  });

  $: if ($pwaState.isStandalone && !installedWasStandalone) {
    installedWasStandalone = true;
    handleInstalled();
  } else if (!$pwaState.isStandalone) {
    installedWasStandalone = false;
  }
</script>

{#if showInstallButton || showUpdateButton}
  <div class="space-y-1">
    {#if showInstallButton}
      <button type="button" class={buttonClass} on:click={requestInstall}>{label}</button>
    {/if}

    {#if showUpdateButton}
      <button type="button" class={buttonClass} on:click={requestUpdate} disabled={$pwaState.updating}>
        {updateLabel}
      </button>
    {/if}

    {#if $pwaState.isIOS && !$pwaState.canInstallPrompt && !compact}
      <p class="px-1 text-xs text-[color:var(--ink2)]">iPhone: dùng Share -> Add to Home Screen.</p>
    {/if}
  </div>
{/if}

<PwaIosGuideModal open={$pwaState.showIOSGuide} on:close={closeIOSGuide} />
