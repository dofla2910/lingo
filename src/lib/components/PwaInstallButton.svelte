<script>
  import { createEventDispatcher, onMount } from "svelte";

  export let buttonClass = "btn btn-soft text-sm";
  export let label = "Cài ứng dụng";
  export let compact = false;

  const dispatch = createEventDispatcher();

  let deferredPrompt;
  let canInstallPrompt = false;
  let isIOS = false;
  let isStandalone = false;
  let showIOSGuide = false;

  function detectStandaloneMode() {
    if (typeof window === "undefined") return false;
    const mediaStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches;
    return Boolean(mediaStandalone || window.navigator.standalone === true);
  }

  function detectIOSDevice() {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent || "";
    const iOSUA = /iPad|iPhone|iPod/i.test(ua);
    const iPadDesktopMode = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
    return iOSUA || iPadDesktopMode;
  }

  function closeIOSGuide() {
    showIOSGuide = false;
  }

  async function requestInstall() {
    if (canInstallPrompt && deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === "accepted") {
        dispatch("toast", "Đang cài ứng dụng Lingo vào màn hình chính.");
      }
      deferredPrompt = undefined;
      canInstallPrompt = false;
      return;
    }

    if (isIOS) {
      showIOSGuide = true;
      return;
    }

    dispatch("toast", "Thiết bị/trình duyệt hiện tại chưa hỗ trợ cài ứng dụng.");
  }

  function onKeydown(event) {
    if (!showIOSGuide) return;
    if (event.key === "Escape") {
      closeIOSGuide();
    }
  }

  onMount(() => {
    isIOS = detectIOSDevice();
    isStandalone = detectStandaloneMode();

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      deferredPrompt = event;
      canInstallPrompt = true;
    };

    const onAppInstalled = () => {
      deferredPrompt = undefined;
      canInstallPrompt = false;
      isStandalone = true;
      showIOSGuide = false;
      dispatch("toast", "Đã cài ứng dụng thành công.");
      dispatch("installed");
    };

    const onVisibilityChange = () => {
      isStandalone = detectStandaloneMode();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("visibilitychange", onVisibilityChange);
    };
  });

  $: showInstallButton = !isStandalone && (canInstallPrompt || isIOS);
</script>

<svelte:window on:keydown={onKeydown} />

{#if showInstallButton}
  <div class="space-y-1">
    <button type="button" class={buttonClass} on:click={requestInstall}>{label}</button>
    {#if isIOS && !canInstallPrompt && !compact}
      <p class="px-1 text-xs text-[color:var(--ink2)]">iPhone: dùng Share -> Add to Home Screen.</p>
    {/if}
  </div>
{/if}

<div class={`modal ${showIOSGuide ? "open" : ""}`} aria-hidden={!showIOSGuide} on:click|self={closeIOSGuide}>
  <div class="modal-card max-w-md" role="dialog" aria-modal="true" aria-labelledby="iosInstallTitle" tabindex="-1">
    <div class="border-b border-pink-100/70 px-4 py-3">
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Cài trên iPhone</p>
      <h3 id="iosInstallTitle" class="text-lg font-bold text-[color:var(--ink)]">Thêm Lingo vào màn hình chính</h3>
    </div>

    <div class="space-y-3 px-4 py-4 text-sm text-[color:var(--ink)]">
      <p>1. Mở menu <strong>Share</strong> trong Safari.</p>
      <p>2. Chọn <strong>Add to Home Screen</strong>.</p>
      <p>3. Nhấn <strong>Add</strong> để cài ứng dụng.</p>
      <p class="rounded-xl border border-pink-100/80 bg-pink-50/70 px-3 py-2 text-xs text-[color:var(--ink2)]">
        Mẹo: đăng nhập trước khi thêm để lần mở đầu giữ đúng phiên của bạn.
      </p>
    </div>

    <div class="flex justify-end border-t border-pink-100/70 px-4 py-3">
      <button type="button" class="btn btn-primary text-sm" on:click={closeIOSGuide}>Đã hiểu</button>
    </div>
  </div>
</div>
