<script>
  import { createEventDispatcher, onMount } from "svelte";
  import PwaIosGuideModal from "./PwaIosGuideModal.svelte";
  import {
    closeIOSGuide,
    pwaState,
    requestPwaInstall,
  } from "$lib/lingo/pwaController.js";

  export let buttonClass = "btn btn-soft text-sm";
  export let label = "Cài ứng dụng";
  export let compact = false;

  const dispatch = createEventDispatcher();

  $: showInstallButton = !$pwaState.isStandalone && ($pwaState.canInstallPrompt || $pwaState.isIOS);

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

{#if showInstallButton}
  <div class="space-y-1">
    <button type="button" class={buttonClass} on:click={requestInstall}>{label}</button>
    {#if $pwaState.isIOS && !$pwaState.canInstallPrompt && !compact}
      <p class="px-1 text-xs text-[color:var(--ink2)]">iPhone: dùng Share -> Add to Home Screen.</p>
    {/if}
  </div>
{/if}

<PwaIosGuideModal open={$pwaState.showIOSGuide} on:close={closeIOSGuide} />
