<script>
  import {
    buildMilestoneView,
    daysUntil,
    formatDate,
    formatDateTime,
    nextMilestoneProgress,
    parseDateTime,
  } from "../lingo/utils.js";

  export let state;
  export let now = Date.now();

  $: nowDate = new Date(now);
  $: startDate = parseDateTime(state?.settings?.startDate || "");
  $: milestoneView = buildMilestoneView(startDate, nowDate);
  $: next = milestoneView.next;
  $: progress = next ? nextMilestoneProgress(startDate, next, nowDate) : 100;
  $: daysLeft = next ? daysUntil(next.date, nowDate) : null;
</script>

<section class="card rounded-3xl p-4 sm:p-5">
  <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
    <div class="xl:col-span-4 space-y-3">
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Svelte • Cột mốc</p>
      <h2 class="text-lg sm:text-xl font-bold text-[color:var(--ink)]">Cột mốc kế tiếp</h2>
      <div class="rounded-2xl border border-white/70 bg-white/70 p-4">
        {#if !startDate}
          <p class="text-sm text-[color:var(--ink2)]">Thiết lập ngày bắt đầu yêu để tính cột mốc.</p>
        {:else if next}
          <div>
            <p class="text-sm text-[color:var(--ink2)]">Mục tiêu</p>
            <p class="mt-1 text-xl font-extrabold text-[color:var(--ink)]">{next.label}</p>
            <p class="mt-1 text-sm text-[color:var(--ink2)]">Dự kiến: {formatDateTime(next.date)}</p>
            <div class="mt-3 grid grid-cols-2 gap-3">
              <div class="rounded-xl border border-white/80 bg-white/70 p-3">
                <p class="text-xs uppercase tracking-[.12em] text-[color:var(--ink2)]">Còn lại</p>
                <p class="mt-1 text-lg font-extrabold text-pink-600">
                  {daysLeft === 0 ? "Hôm nay" : `${daysLeft} ngày`}
                </p>
              </div>
              <div class="rounded-xl border border-white/80 bg-white/70 p-3">
                <p class="text-xs uppercase tracking-[.12em] text-[color:var(--ink2)]">Tiến độ</p>
                <p class="mt-1 text-lg font-extrabold text-pink-600">{Math.round(progress)}%</p>
              </div>
            </div>
            <div class="prog mt-3"><span style={`width:${Math.max(0, Math.min(100, progress))}%`}></span></div>
          </div>
        {:else}
          <p class="text-sm text-[color:var(--ink2)]">Hai bạn đã chinh phục tất cả cột mốc hiện có.</p>
          <div class="mt-3 rounded-xl border border-white/80 bg-white/70 p-3">
            <p class="font-semibold text-[color:var(--ink)]">Bắt đầu từ {formatDate(startDate)}</p>
          </div>
          <div class="prog mt-3"><span style="width:100%"></span></div>
        {/if}
      </div>
    </div>

    <div class="xl:col-span-8">
      <p class="text-sm text-[color:var(--ink2)]">Badge sáng khi đạt cột mốc. Trạng thái được đọc trực tiếp từ Supabase Realtime.</p>
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
              <span class="absolute right-2 top-2 text-sm" aria-hidden="true">🦩🏆</span>
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
    </div>
  </div>
</section>
