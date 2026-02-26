<script>
  import { createEventDispatcher } from "svelte";
  import {
    EVENT_CATEGORY_LABELS,
    formatDate,
    isTodayEvent,
    nextOccurrenceForEvent,
    parseDate,
    sortEventsForDisplay,
    daysUntil,
  } from "../lingo/utils.js";

  export let state;
  export let now = Date.now();
  export let actions;
  export let showQuickActions = false;
  export let pairActionLabel = "Kết nối cặp đôi";
  export let pairActionConnected = false;

  const dispatch = createEventDispatcher();

  let editingId = "";
  let title = "";
  let category = "sinh_nhat";
  let date = "";
  let note = "";
  let repeatAnnual = false;
  let errorText = "";

  $: today = new Date(now);
  $: sortedEvents = sortEventsForDisplay(state?.events || [], today);
  $: displayRows = sortedEvents.map((row) => ({ ...row, info: occInfo(row.event) }));
  $: countLabel = `${sortedEvents.length} sự kiện`;

  function resetForm() {
    editingId = "";
    title = "";
    category = "sinh_nhat";
    date = "";
    note = "";
    repeatAnnual = false;
    errorText = "";
  }

  function editEvent(item) {
    editingId = item.id;
    title = item.title || "";
    category = item.category || "khac";
    date = item.date || "";
    note = item.note || "";
    repeatAnnual = !!item.repeatAnnual;
    errorText = "";
  }

  async function submitForm() {
    errorText = "";
    if (!title.trim()) {
      errorText = "Vui lòng nhập tên sự kiện.";
      return;
    }
    if (!parseDate(date)) {
      errorText = "Ngày sự kiện không hợp lệ.";
      return;
    }
    try {
      await actions.upsertEvent({
        id: editingId || undefined,
        title: title.trim(),
        category,
        date,
        note: note.trim(),
        repeatAnnual,
      });
      resetForm();
    } catch (err) {
      errorText = err?.message || "Không thể lưu sự kiện.";
    }
  }

  async function removeEvent(item) {
    if (!confirm(`Xoá sự kiện "${item.title}"?`)) return;
    try {
      await actions.deleteEvent(item.id);
      if (editingId === item.id) resetForm();
    } catch (err) {
      errorText = err?.message || "Không thể xoá sự kiện.";
    }
  }

  function occInfo(item) {
    const occ = nextOccurrenceForEvent(item, today);
    const d = occ ? daysUntil(occ, today) : null;
    return { occ, daysLeft: d, today: isTodayEvent(item, today) };
  }
</script>

<section class="card rounded-3xl p-4 sm:p-5">
  <div>
    <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Ngày đặc biệt</p>
    <h2 class="text-lg sm:text-xl font-bold text-[color:var(--ink)]">Quản lý ngày quan trọng</h2>
    <p class="text-sm text-[color:var(--ink2)]">CRUD + sắp xếp ngày gần nhất + highlight hôm nay.</p>
  </div>

  {#if showQuickActions}
    <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
      <button
        class={`btn text-sm w-full ${pairActionConnected ? "btn-soft" : "btn-primary"}`}
        type="button"
        on:click={() => dispatch("openpairing")}
      >
        {pairActionLabel}
      </button>
      <button class="btn btn-soft text-sm w-full" type="button" on:click={() => dispatch("opensettings")}>Cài đặt</button>
      <button class="btn btn-primary text-sm w-full" type="button" on:click={() => dispatch("openwizard")}>Wizard nhanh</button>
    </div>
  {/if}

  <form class="mt-4 space-y-3 rounded-2xl border border-white/70 bg-white/65 p-4" on:submit|preventDefault={submitForm}>
    <div>
      <label class="label" for="sv_ev_title">Tên sự kiện</label>
      <input id="sv_ev_title" class="field mt-1 text-sm" bind:value={title} maxlength="80" placeholder="Ví dụ: Kỷ niệm lần hẹn đầu" />
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label class="label" for="sv_ev_cat">Loại</label>
        <select id="sv_ev_cat" class="field mt-1 text-sm" bind:value={category}>
          <option value="sinh_nhat">Sinh nhật</option>
          <option value="ky_niem">Kỷ niệm</option>
          <option value="hen_ho">Hẹn hò</option>
          <option value="khac">Khác</option>
        </select>
      </div>
      <div>
        <label class="label" for="sv_ev_date">Ngày</label>
        <input id="sv_ev_date" class="field mt-1 text-sm" type="date" bind:value={date} />
      </div>
    </div>
    <div>
      <label class="label" for="sv_ev_note">Ghi chú (tuỳ chọn)</label>
      <textarea id="sv_ev_note" class="field mt-1 text-sm" rows="2" maxlength="240" bind:value={note} placeholder="Lời nhắn ngắn..."></textarea>
    </div>
    <label class="flex items-center gap-2 text-sm text-[color:var(--ink)]">
      <input class="h-4 w-4 rounded" type="checkbox" bind:checked={repeatAnnual} />
      <span>Lặp lại hàng năm</span>
    </label>
    {#if errorText}
      <p class="text-sm font-medium text-rose-600">{errorText}</p>
    {/if}
    <div class="flex flex-wrap gap-2">
      <button class="btn btn-primary text-sm" type="submit">
        {editingId ? "Lưu chỉnh sửa" : "Thêm ngày đặc biệt"}
      </button>
      {#if editingId}
        <button class="btn btn-soft text-sm" type="button" on:click={resetForm}>Huỷ sửa</button>
      {/if}
    </div>
  </form>

  <div class="mt-4 flex items-center justify-between">
    <p class="text-sm font-semibold text-[color:var(--ink)]">Danh sách sự kiện</p>
    <p class="text-xs text-[color:var(--ink2)]">{countLabel}</p>
  </div>

  <div class="mt-2 space-y-3">
    {#if sortedEvents.length === 0}
      <div class="rounded-2xl border border-white/70 bg-white/60 p-4 text-sm text-[color:var(--ink2)]">
        Chưa có sự kiện nào. Hãy thêm một ngày thật đặc biệt cho hai bạn.
      </div>
    {:else}
      {#each displayRows as row (row.event.id)}
        <article
          class={`rounded-2xl border p-4 transition ${
            row.info.today
              ? "border-pink-300/90 bg-gradient-to-r from-pink-50 to-white shadow-sm shadow-pink-200/50 animate-pulse"
              : "border-white/70 bg-white/65"
          }`}
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center rounded-full border border-pink-200/80 bg-pink-50 px-2 py-0.5 text-xs font-semibold text-pink-700">
                  {EVENT_CATEGORY_LABELS[row.event.category] || "Khác"}
                </span>
                {#if row.event.repeatAnnual}
                  <span class="pill">Lặp hàng năm</span>
                {/if}
                <span class={`pill ${row.info.today ? "text-pink-600" : ""}`}>{row.info.today ? "Hôm nay" : "Sắp tới"}</span>
              </div>
              <h3 class="mt-2 text-base font-bold text-[color:var(--ink)]">{row.event.title}</h3>
              {#if row.event.note}
                <p class="mt-1 text-sm text-[color:var(--ink2)]">{row.event.note}</p>
              {/if}
              <p class="mt-2 text-xs text-[color:var(--ink2)]">
                Ngày gốc: {formatDate(parseDate(row.event.date))}
                {#if row.info.occ}
                  • Lần tới: {formatDate(row.info.occ)}
                {/if}
                {#if row.info.daysLeft !== null}
                  • {row.info.daysLeft === 0 ? "Đến hôm nay" : `Còn ${row.info.daysLeft} ngày`}
                {/if}
              </p>
            </div>

            <div class="flex shrink-0 gap-2">
              <button class="btn btn-soft text-sm" type="button" on:click={() => editEvent(row.event)}>Sửa</button>
              <button class="btn btn-soft text-sm !text-rose-600" type="button" on:click={() => removeEvent(row.event)}>Xoá</button>
            </div>
          </div>
        </article>
      {/each}
    {/if}
  </div>
</section>
