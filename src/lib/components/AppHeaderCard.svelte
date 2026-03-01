<script>
  import { createEventDispatcher } from "svelte";
  import PwaInstallButton from "./PwaInstallButton.svelte";

  const dispatch = createEventDispatcher();

  function handleToast(event) {
    dispatch("toast", event.detail);
  }
</script>

<header class="card app-header-card rounded-3xl p-4 sm:p-5">
  <div class="flex min-w-0 items-start justify-between gap-3 sm:gap-4">
    <div class="flex min-w-0 items-start gap-3 sm:gap-4">
      <div class="h-14 w-14 shrink-0 rounded-2xl border border-white/80 bg-white/70 p-1 shadow-sm shadow-pink-200/40 sm:h-16 sm:w-16">
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
        <h1 class="app-title font-extrabold leading-tight text-[color:var(--ink)]">Bộ đếm ngày yêu Hồng Hạc</h1>
        <p class="app-tagline mt-1 text-[color:var(--ink2)]">
          Tình yêu bền vững như loài Hạc (chung thủy trọn đời) và rực rỡ như hoa Tulip (tình yêu hoàn hảo).
        </p>
      </div>
    </div>
    <div class="hidden shrink-0 sm:block">
      <PwaInstallButton
        buttonClass="btn btn-soft min-h-[44px] text-sm whitespace-nowrap"
        label="Cài ứng dụng"
        compact={true}
        on:toast={handleToast}
      />
    </div>
  </div>
  <div class="mt-3 sm:hidden">
    <PwaInstallButton
      buttonClass="btn btn-soft min-h-[44px] text-sm w-full"
      label="Cài ứng dụng"
      compact={true}
      on:toast={handleToast}
    />
  </div>
</header>

<style>
  .app-header-card {
    container-type: inline-size;
  }

  .app-title {
    font-size: clamp(1.55rem, 4.5vw, 2.3rem);
  }

  .app-tagline {
    font-size: clamp(0.98rem, 2.6vw, 1.1rem);
  }

  @container (max-width: 27rem) {
    .app-title {
      font-size: clamp(1.35rem, 6.8vw, 1.75rem);
    }
  }
</style>
