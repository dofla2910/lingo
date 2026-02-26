<script>
  import { elapsedCalendar, formatDateTime, pad2, parseDateTime } from "../lingo/utils.js";

  export let state;
  export let now = Date.now();

  const labels = [
    ["years", "Năm"],
    ["months", "Tháng"],
    ["days", "Ngày"],
    ["hours", "Giờ"],
    ["minutes", "Phút"],
    ["seconds", "Giây"],
  ];

  $: nowDate = new Date(now);
  $: startDate = parseDateTime(state?.settings?.startDate || "");
  $: invalidFuture = startDate && nowDate < startDate;
  $: diff = startDate && !invalidFuture ? elapsedCalendar(startDate, nowDate) : elapsedCalendar(null, null);
  $: tiles = {
    years: diff.years ?? 0,
    months: diff.months ?? 0,
    days: diff.days ?? 0,
    hours: diff.hours ?? 0,
    minutes: diff.minutes ?? 0,
    seconds: diff.seconds ?? 0,
  };
  $: timerNote = !startDate
    ? "Hãy nhập ngày bắt đầu yêu để bắt đầu đếm."
    : invalidFuture
      ? "Ngày bắt đầu yêu đang ở tương lai."
      : "Hai bạn đã bên nhau qua những khoảnh khắc thật đẹp.";
</script>

<section class="card rounded-3xl p-4 sm:p-5">
  <div class="flex flex-col gap-3 sm:flex-row sm:justify-between">
    <div>
      <span class="pill text-pink-600">⏱ Thời gian yêu đang chạy</span>
      <h2 class="mt-3 text-lg sm:text-xl font-bold text-[color:var(--ink)]">Bộ đếm tình yêu thời gian thực</h2>
      <p class="mt-1 text-sm text-[color:var(--ink2)]">{timerNote}</p>
    </div>
    <div class="text-left sm:text-right">
      <p class="text-xs uppercase tracking-[.12em] text-pink-500/80">Ngày bắt đầu</p>
      <p class="text-sm font-semibold text-[color:var(--ink)]">
        {startDate ? formatDateTime(startDate) : "Chưa thiết lập"}
      </p>
    </div>
  </div>

  <div class="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
    {#each labels as [key, label]}
      <div class="timer-tile p-3 text-center">
        <div class="timer-value text-2xl sm:text-3xl font-extrabold text-pink-600">
          {pad2(tiles[key])}
        </div>
        <div class="mt-1 text-[11px] uppercase tracking-[.12em] text-[color:var(--ink2)] font-semibold">
          {label}
        </div>
      </div>
    {/each}
  </div>

  <p class="sr-only" aria-live="polite">
    {startDate
      ? `Bộ đếm đang hiển thị ${tiles.years} năm, ${tiles.months} tháng, ${tiles.days} ngày, ${tiles.hours} giờ, ${tiles.minutes} phút, ${tiles.seconds} giây`
      : "Chưa thiết lập ngày bắt đầu yêu"}
  </p>
</section>
