<script>
  export let stats = {
    todayTotal: 0,
    todaySent: 0,
    todayReceived: 0,
  };
</script>

<div class="mt-4 grid grid-cols-3 gap-2">
  <div class="rounded-2xl border border-pink-100/80 bg-white/75 p-3 text-center">
    <p class="text-[11px] font-semibold uppercase tracking-[.12em] text-pink-500/75">Hôm nay</p>
    <p class="mt-1 text-xl font-extrabold text-[color:var(--ink)]">{stats.todayTotal}</p>
    <p class="text-[11px] text-[color:var(--ink2)]">Tổng chạm</p>
  </div>
  <div class="rounded-2xl border border-pink-100/80 bg-white/75 p-3 text-center">
    <p class="text-[11px] font-semibold uppercase tracking-[.12em] text-pink-500/75">Bạn gửi</p>
    <p class="mt-1 text-xl font-extrabold text-[color:var(--ink)]">{stats.todaySent}</p>
    <p class="text-[11px] text-[color:var(--ink2)]">Nhịp yêu</p>
  </div>
  <div class="rounded-2xl border border-pink-100/80 bg-white/75 p-3 text-center">
    <p class="text-[11px] font-semibold uppercase tracking-[.12em] text-pink-500/75">Nhận được</p>
    <p class="mt-1 text-xl font-extrabold text-[color:var(--ink)]">{stats.todayReceived}</p>
    <p class="text-[11px] text-[color:var(--ink2)]">Từ người ấy</p>
  </div>
</div>
