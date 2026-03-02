<script>
  import { createEventDispatcher } from "svelte";
  import { countdownLabel, formatDateTime, isUnlocked } from "$lib/lingo/timeCapsuleUtils.js";

  export let item = null;
  export let now = Date.now();

  const dispatch = createEventDispatcher();

  $: unlocked = isUnlocked(item, now);

  function openCapsule() {
    dispatch("open", item);
  }
</script>

<button
  type="button"
  class={`w-full text-left rounded-2xl border p-4 transition ${
    unlocked
      ? "border-pink-200/90 bg-gradient-to-br from-white to-pink-50/80 shadow-[0_0_0_1px_rgba(255,185,214,0.45),0_14px_30px_rgba(255,140,184,0.18)]"
      : "border-rose-200/80 bg-gradient-to-br from-rose-50/85 via-white to-pink-100/70"
  }`}
  on:click={openCapsule}
>
  <div class="flex items-start justify-between gap-3">
    <div class="min-w-0">
      <p class="text-xs font-semibold uppercase tracking-[.14em] text-pink-500/80">
        {unlocked ? "🔓 Đã mở" : "🔒 Đang khoá"}
      </p>
      <h3 class="mt-1 line-clamp-2 text-base font-bold text-[color:var(--ink)]">{item?.title || ""}</h3>
    </div>
    <p class="pill shrink-0 text-[10px]">{formatDateTime(item?.unlock_at)}</p>
  </div>

  {#if unlocked}
    <p class="mt-3 line-clamp-3 text-sm text-[color:var(--ink2)]">{item?.message || ""}</p>
  {:else}
    <p class="mt-3 text-sm font-semibold text-pink-600">{countdownLabel(item?.unlock_at, now)}</p>
    <p class="mt-1 text-xs text-[color:var(--ink2)]">Định dạng: Ngày : Giờ : Phút : Giây</p>
  {/if}
</button>
