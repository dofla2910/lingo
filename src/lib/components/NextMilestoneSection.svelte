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
  <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Tiếp theo</p>
  <h2 class="text-lg font-bold text-[color:var(--ink)]">Cột mốc kế tiếp</h2>

  <div class="mt-4 space-y-3">
    <div class="rounded-2xl border border-white/70 bg-white/65 p-4">
      {#if !startDate}
        <p class="text-sm text-[color:var(--ink2)]">Mục tiêu</p>
        <p class="mt-1 text-lg font-bold text-[color:var(--ink)]">Chưa có dữ liệu</p>
        <p class="mt-1 text-sm text-[color:var(--ink2)]">Thiết lập ngày bắt đầu yêu</p>
      {:else if next}
        <p class="text-sm text-[color:var(--ink2)]">Mục tiêu</p>
        <p class="mt-1 text-lg font-bold text-[color:var(--ink)]">{next.label}</p>
        <p class="mt-1 text-sm text-[color:var(--ink2)]">Dự kiến: {formatDateTime(next.date)}</p>
      {:else}
        <p class="text-sm text-[color:var(--ink2)]">Mục tiêu</p>
        <p class="mt-1 text-lg font-bold text-[color:var(--ink)]">Đã chinh phục tất cả!</p>
        <p class="mt-1 text-sm text-[color:var(--ink2)]">
          {startDate ? `Bắt đầu từ ${formatDate(startDate)}` : "—"}
        </p>
      {/if}
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-2xl border border-white/70 bg-white/65 p-4">
        <p class="text-xs uppercase tracking-[.12em] text-[color:var(--ink2)]">Còn lại</p>
        <p class="mt-1 text-xl font-extrabold text-pink-600">
          {!startDate ? "--" : !next ? "0 ngày" : daysLeft === 0 ? "Hôm nay" : `${daysLeft} ngày`}
        </p>
      </div>
      <div class="rounded-2xl border border-white/70 bg-white/65 p-4">
        <p class="text-xs uppercase tracking-[.12em] text-[color:var(--ink2)]">Tiến độ</p>
        <p class="mt-1 text-xl font-extrabold text-pink-600">{Math.round(progress)}%</p>
      </div>
    </div>

    <div class="prog">
      <span style={`width:${Math.max(0, Math.min(100, progress))}%`}></span>
    </div>
  </div>
</section>
