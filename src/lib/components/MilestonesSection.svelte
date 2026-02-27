<script>
  import { buildMilestoneView, formatDate, parseDateTime } from "../lingo/utils.js";

  export let state;
  export let now = Date.now();

  $: nowDate = new Date(now);
  $: startDate = parseDateTime(state?.settings?.startDate || "");
  $: milestoneView = buildMilestoneView(startDate, nowDate);
</script>

<section class="card rounded-3xl p-4 sm:p-5">
  <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Gamification</p>
  <h2 class="text-lg sm:text-xl font-bold text-[color:var(--ink)]">Cột mốc tình yêu</h2>
  <p class="text-sm text-[color:var(--ink2)]">Badge sáng lên khi hai bạn chinh phục các chặng đường.</p>

  <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
    {#each milestoneView.items as item}
      <article
        class={`relative overflow-hidden rounded-2xl border p-3 transition ${
          item.achieved
            ? "border-pink-200/80 bg-gradient-to-br from-white to-pink-50 shadow-sm shadow-pink-200/40"
            : "border-white/80 bg-white/60 opacity-80"
        }`}
      >
        {#if item.achieved}
          <span class="absolute right-2 top-2 text-sm" aria-hidden="true">🦩</span>
        {:else}
          <span class="absolute right-2 top-2 text-xs text-[color:var(--ink2)]" aria-hidden="true">🔒</span>
        {/if}
        <p class="text-sm font-bold text-[color:var(--ink)]">{item.label}</p>
        <p class="mt-1 text-xs text-[color:var(--ink2)]">{item.achieved ? "Đã đạt" : "Chưa đạt"}</p>
        <p class="mt-1 text-xs text-[color:var(--ink2)]">
          {item.date ? `Dự kiến: ${formatDate(item.date)}` : "—"}
        </p>
      </article>
    {/each}
  </div>
</section>
