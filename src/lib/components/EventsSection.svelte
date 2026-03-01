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

  const PREVIEW_LIMIT = 3;
  let eventsModalOpen = false;
  let eventFormModalOpen = false;

  $: today = new Date(now);
  $: sortedEvents = sortEventsForDisplay(state?.events || [], today);
  $: displayRows = sortedEvents.map((row) => ({ ...row, info: occInfo(row.event) }));
  $: hiddenCount = Math.max(0, displayRows.length - PREVIEW_LIMIT);
  $: visibleRows = displayRows.slice(0, PREVIEW_LIMIT);
  $: if (hiddenCount === 0 && eventsModalOpen) eventsModalOpen = false;
  $: countLabel = `${sortedEvents.length} sự kiện`;
  $: hiddenCountBadge = hiddenCount > 99 ? "99+" : String(hiddenCount);

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

  function openCreateEventModal() {
    resetForm();
    eventFormModalOpen = true;
  }

  function openEditEventModal(item, options = {}) {
    editEvent(item);
    eventFormModalOpen = true;
    if (options.closeListModal) {
      closeEventsModal();
    }
  }

  function closeEventFormModal() {
    eventFormModalOpen = false;
    resetForm();
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
      closeEventFormModal();
    } catch (err) {
      errorText = err?.message || "Không thể lưu sự kiện.";
    }
  }

  async function removeEvent(item) {
    if (!confirm(`Xoá sự kiện "${item.title}"?`)) return;
    try {
      await actions.deleteEvent(item.id);
      if (editingId === item.id) {
        closeEventFormModal();
      }
    } catch (err) {
      errorText = err?.message || "Không thể xoá sự kiện.";
    }
  }

  function occInfo(item) {
    const occ = nextOccurrenceForEvent(item, today);
    const d = occ ? daysUntil(occ, today) : null;
    const isToday = isTodayEvent(item, today);
    const past = !item?.repeatAnnual && d !== null && d < 0;
    return { occ, daysLeft: d, today: isToday, past };
  }

  function eventStatusLabel(info) {
    if (info?.today) return "Hôm nay";
    if (info?.past) return "Đã qua";
    return "Sắp tới";
  }

  function eventDistanceLabel(info) {
    const d = Number(info?.daysLeft);
    if (!Number.isFinite(d)) return "";
    if (d === 0) return "Đến hôm nay";
    if (d > 0) return `Còn ${d} ngày`;
    return `Đã qua ${Math.abs(d)} ngày`;
  }

  function eventCardClass(info) {
    if (info?.today) {
      return "rounded-2xl border p-4 transition border-pink-300/90 bg-gradient-to-r from-pink-50 to-white shadow-sm shadow-pink-200/50 animate-pulse";
    }
    return "rounded-2xl border p-4 transition border-white/70 bg-white/65";
  }

  function openEventsModal() {
    eventsModalOpen = true;
  }

  function closeEventsModal() {
    eventsModalOpen = false;
  }

  function handleWindowKeydown(event) {
    if (event.key !== "Escape") return;
    if (eventFormModalOpen) {
      closeEventFormModal();
      return;
    }
    if (eventsModalOpen) {
      closeEventsModal();
    }
  }
</script>

<svelte:window on:keydown={handleWindowKeydown} />

<section class="card events-section rounded-3xl p-4 sm:p-5">
  <div>
    <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Ngày đặc biệt</p>
    <h2 class="text-lg sm:text-xl font-bold text-[color:var(--ink)]">Quản lý ngày quan trọng</h2>
    <p class="text-sm text-[color:var(--ink2)]">Thêm, sửa, xoá sự kiện; tự ưu tiên ngày gần nhất và làm nổi bật sự kiện hôm nay.</p>
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

  <div class="events-toolbar mt-4">
    <p class="text-sm font-semibold text-[color:var(--ink)]">Danh sách sự kiện</p>
    <div class="events-toolbar-actions">
      <button class="btn btn-primary !px-3.5 !py-1.5 text-xs min-h-[40px] w-full sm:w-auto whitespace-nowrap" type="button" on:click={openCreateEventModal}>
        + Thêm sự kiện
      </button>
      <span class="pill h-10 text-[11px] font-semibold text-[color:var(--ink2)]">{countLabel}</span>
      {#if hiddenCount > 0}
        <button class="btn btn-soft relative !px-4 !py-2 text-xs font-semibold min-h-[40px] w-full sm:w-auto whitespace-nowrap" type="button" on:click={openEventsModal}>
          Xem thêm
          <span
            class="badge-primary pointer-events-none absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none shadow-sm shadow-pink-300/60 ring-2 ring-white/90"
            aria-label={`Còn ${hiddenCount} sự kiện`}
          >
            {hiddenCountBadge}
          </span>
        </button>
      {/if}
    </div>
  </div>

  <div class="mt-2 space-y-3">
    {#if sortedEvents.length === 0}
      <div class="rounded-2xl border border-white/70 bg-white/60 p-4 text-sm text-[color:var(--ink2)]">
        Chưa có sự kiện nào. Hãy thêm một ngày thật đặc biệt cho hai bạn.
      </div>
    {:else}
      {#each visibleRows as row (row.event.id)}
        <article class={eventCardClass(row.info)}>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center rounded-full border border-pink-200/80 bg-pink-50 px-2 py-0.5 text-xs font-semibold text-pink-700">
                  {EVENT_CATEGORY_LABELS[row.event.category] || "Khác"}
                </span>
                {#if row.event.repeatAnnual}
                  <span class="pill">Lặp hàng năm</span>
                {/if}
                <span class={`pill ${row.info.today ? "text-pink-600" : row.info.past ? "text-slate-500" : ""}`}>
                  {eventStatusLabel(row.info)}
                </span>
              </div>
              <h3 class="mt-2 text-base font-bold text-[color:var(--ink)]">{row.event.title}</h3>
              {#if row.event.note}
                <p class="mt-1 text-sm text-[color:var(--ink2)]">{row.event.note}</p>
              {/if}
              <p class="mt-2 text-xs text-[color:var(--ink2)]">
                Ngày gốc: {formatDate(parseDate(row.event.date))}
                {#if row.event.repeatAnnual && row.info.occ}
                  • Lần tới: {formatDate(row.info.occ)}
                {/if}
                {#if row.info.daysLeft !== null}
                  • {eventDistanceLabel(row.info)}
                {/if}
              </p>
            </div>

            <div class="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
              <button class="btn btn-soft text-sm min-h-[40px] w-full sm:w-auto" type="button" on:click={() => openEditEventModal(row.event)}>Sửa</button>
              <button class="btn btn-soft text-sm !text-rose-600 min-h-[40px] w-full sm:w-auto" type="button" on:click={() => removeEvent(row.event)}>Xoá</button>
            </div>
          </div>
        </article>
      {/each}
    {/if}
  </div>
</section>

<div class={`modal ${eventFormModalOpen ? "open" : ""}`} aria-hidden={!eventFormModalOpen} on:click|self={closeEventFormModal}>
  <div class="modal-card max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="eventFormModalTitle" tabindex="-1">
    <div class="flex items-center justify-between border-b border-pink-100/70 px-4 py-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Ngày đặc biệt</p>
        <h3 id="eventFormModalTitle" class="text-lg font-bold text-[color:var(--ink)]">
          {editingId ? "Sửa sự kiện" : "Thêm ngày đặc biệt"}
        </h3>
      </div>
      <button type="button" class="btn btn-soft text-sm" on:click={closeEventFormModal}>Đóng</button>
    </div>

    <form class="space-y-3 px-4 py-4" on:submit|preventDefault={submitForm}>
      <div>
        <label class="label" for="sv_ev_title">Tên sự kiện</label>
        <input id="sv_ev_title" class="field mt-1 text-sm" bind:value={title} maxlength="80" placeholder="Ví dụ: Kỷ niệm lần hẹn đầu" />
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <textarea id="sv_ev_note" class="field mt-1 text-sm" rows="3" maxlength="240" bind:value={note} placeholder="Lời nhắn ngắn..."></textarea>
      </div>
      <label class="flex items-center gap-2 text-sm text-[color:var(--ink)]">
        <input class="h-4 w-4 rounded" type="checkbox" bind:checked={repeatAnnual} />
        <span>Lặp lại hàng năm</span>
      </label>

      {#if errorText}
        <p class="text-sm font-medium text-rose-600">{errorText}</p>
      {/if}

      <div class="flex flex-wrap justify-end gap-2 border-t border-pink-100/70 pt-3">
        {#if editingId}
          <button class="btn btn-soft text-sm" type="button" on:click={resetForm}>Làm mới</button>
        {/if}
        <button class="btn btn-soft text-sm" type="button" on:click={closeEventFormModal}>Huỷ</button>
        <button class="btn btn-primary text-sm" type="submit">
          {editingId ? "Lưu chỉnh sửa" : "Thêm ngày đặc biệt"}
        </button>
      </div>
    </form>
  </div>
</div>

<div class={`modal ${eventsModalOpen ? "open" : ""}`} aria-hidden={!eventsModalOpen} on:click|self={closeEventsModal}>
  <div class="modal-card max-w-4xl" role="dialog" aria-modal="true" aria-labelledby="eventsModalTitle" tabindex="-1">
    <div class="flex items-center justify-between border-b border-pink-100/70 px-4 py-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Ngày đặc biệt</p>
        <h3 id="eventsModalTitle" class="text-lg font-bold text-[color:var(--ink)]">Danh sách sự kiện</h3>
      </div>
      <div class="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
        <span class="pill text-[11px] font-semibold text-[color:var(--ink2)]">{countLabel}</span>
        <button class="btn btn-primary text-sm min-h-[40px] w-full sm:w-auto" type="button" on:click={() => openCreateEventModal()}>+ Thêm</button>
        <button type="button" class="btn btn-soft text-sm min-h-[40px] w-full sm:w-auto" on:click={closeEventsModal}>Đóng</button>
      </div>
    </div>

    <div class="max-h-[72vh] space-y-3 overflow-y-auto px-4 py-4">
      {#if displayRows.length === 0}
        <div class="rounded-2xl border border-white/70 bg-white/60 p-4 text-sm text-[color:var(--ink2)]">
          Chưa có sự kiện nào.
        </div>
      {:else}
        {#each displayRows as row (row.event.id)}
          <article class={eventCardClass(row.info)}>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-flex items-center rounded-full border border-pink-200/80 bg-pink-50 px-2 py-0.5 text-xs font-semibold text-pink-700">
                    {EVENT_CATEGORY_LABELS[row.event.category] || "Khác"}
                  </span>
                  {#if row.event.repeatAnnual}
                    <span class="pill">Lặp hàng năm</span>
                  {/if}
                  <span class={`pill ${row.info.today ? "text-pink-600" : row.info.past ? "text-slate-500" : ""}`}>
                    {eventStatusLabel(row.info)}
                  </span>
                </div>
                <h3 class="mt-2 text-base font-bold text-[color:var(--ink)]">{row.event.title}</h3>
                {#if row.event.note}
                  <p class="mt-1 text-sm text-[color:var(--ink2)]">{row.event.note}</p>
                {/if}
                <p class="mt-2 text-xs text-[color:var(--ink2)]">
                  Ngày gốc: {formatDate(parseDate(row.event.date))}
                  {#if row.event.repeatAnnual && row.info.occ}
                    • Lần tới: {formatDate(row.info.occ)}
                  {/if}
                  {#if row.info.daysLeft !== null}
                    • {eventDistanceLabel(row.info)}
                  {/if}
                </p>
              </div>

              <div class="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                <button class="btn btn-soft text-sm min-h-[40px] w-full sm:w-auto" type="button" on:click={() => openEditEventModal(row.event, { closeListModal: true })}>
                  Sửa
                </button>
                <button class="btn btn-soft text-sm !text-rose-600 min-h-[40px] w-full sm:w-auto" type="button" on:click={() => removeEvent(row.event)}>Xoá</button>
              </div>
            </div>
          </article>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .events-section {
    container-type: inline-size;
  }

  .events-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .events-toolbar-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: flex-end;
    width: 100%;
  }

  @media (min-width: 640px) {
    .events-toolbar-actions {
      width: auto;
    }
  }

  @container (max-width: 28rem) {
    .events-toolbar-actions {
      justify-content: flex-start;
    }
  }
</style>
