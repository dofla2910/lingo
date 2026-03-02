<script>
  import { createEventDispatcher } from "svelte";
  import HeartbeatButton from "./HeartbeatButton.svelte";
  import PingStatsGrid from "./PingStatsGrid.svelte";

  export let hasRoom = false;
  export let roomId = "";
  export let pingBusy = false;
  export let stats = {
    dateKey: "",
    todayTotal: 0,
    todaySent: 0,
    todayReceived: 0,
  };

  const dispatch = createEventDispatcher();

  $: todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  $: viewStats =
    stats?.dateKey === todayKey
      ? stats
      : { dateKey: todayKey, todayTotal: 0, todaySent: 0, todayReceived: 0 };

  function onPing() {
    dispatch("ping");
  }
</script>

<section class="card rounded-3xl p-4 sm:p-5" aria-labelledby="heartbeatTitle">
  <div class="flex items-start justify-between gap-3">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Nút chạm</p>
      <h2 id="heartbeatTitle" class="text-lg sm:text-xl font-bold text-[color:var(--ink)]">Chạm nhớ nhau ngay</h2>
      <p class="mt-1 text-sm text-[color:var(--ink2)]">
        Gửi một nhịp yêu thương để người ấy thấy tim bay tức thì.
      </p>
    </div>
    <span class="pill shrink-0">{hasRoom ? `Phòng ${roomId}` : "Chưa ghép phòng"}</span>
  </div>

  <div class="mt-3">
    <HeartbeatButton disabled={!hasRoom} busy={pingBusy} on:ping={onPing} />
    {#if !hasRoom}
      <p class="mt-2 text-xs text-[color:var(--ink2)]">Hãy ghép cặp để bật Nút chạm thời gian thực.</p>
    {/if}
  </div>

  <PingStatsGrid stats={viewStats} />
</section>
