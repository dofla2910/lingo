<script>
  import { createEventDispatcher } from "svelte";
  import ModalShell from "./ModalShell.svelte";
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

  function openCreateEventModal(options = {}) {
    if (options.closeListModal) {
      closeEventsModal();
    }
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
  <div class="events-head">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Ngày đặc biệt</p>
      <h2 class="text-lg sm:text-xl font-bold text-[color:var(--ink)]">Quản lý ngày quan trọng</h2>
      <p class="text-sm text-[color:var(--ink2)]">Thêm, sửa, xoá sự kiện; tự ưu tiên ngày gần nhất và làm nổi bật sự kiện hôm nay.</p>
    </div>

    {#if showQuickActions}
      <div class="events-quick-actions">
        <button
          class={`btn text-sm w-full event-toolbar-btn ${pairActionConnected ? "btn-soft" : "btn-primary"}`}
          type="button"
          on:click={() => dispatch("openpairing")}
        >
          {pairActionLabel}
        </button>
        <button class="btn btn-soft text-sm w-full event-toolbar-btn" type="button" on:click={() => dispatch("opensettings")}>Cài đặt</button>
        <button class="btn btn-primary text-sm w-full event-toolbar-btn" type="button" on:click={() => dispatch("openwizard")}>Wizard nhanh</button>
      </div>
    {/if}
  </div>

  <div class="events-toolbar mt-4">
    <p class="text-sm font-semibold text-[color:var(--ink)]">Danh sách sự kiện</p>
    <div class="events-toolbar-controls">
      <button class="btn btn-primary event-toolbar-btn events-toolbar-main !px-3.5 !py-1.5 text-xs whitespace-nowrap" type="button" on:click={openCreateEventModal}>
        + Thêm sự kiện
      </button>
      <div class="events-toolbar-meta">
        <span class="pill events-count-pill text-[11px] font-semibold text-[color:var(--ink2)]">{countLabel}</span>
        {#if hiddenCount > 0}
          <button class="btn btn-soft event-toolbar-btn event-more-btn text-xs font-semibold whitespace-nowrap" type="button" on:click={openEventsModal}>
            Xem thêm
            <span
              class="badge-primary event-more-badge pointer-events-none inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none shadow-sm shadow-pink-300/60 ring-2 ring-white/90"
              aria-label={`Còn ${hiddenCount} sự kiện`}
            >
              {hiddenCountBadge}
            </span>
          </button>
        {/if}
      </div>
    </div>
  </div>

  <div class="mt-2 space-y-3">
    {#if sortedEvents.length === 0}
      <div class="rounded-2xl border border-white/70 bg-white/60 p-4 text-sm text-[color:var(--ink2)]">
        Chưa có sự kiện nào. Hãy thêm một ngày thật đặc biệt cho hai bạn.
      </div>
    {:else}
      {#each visibleRows as row (row.event.id)}
        <article class={`${eventCardClass(row.info)} event-card`}>
          <div class="event-card-layout">
            <div class="min-w-0">
              <div class="event-chip-row">
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
              <h3 class="event-title mt-2 font-bold text-[color:var(--ink)]">{row.event.title}</h3>
              {#if row.event.note}
                <p class="event-note mt-1 text-sm text-[color:var(--ink2)]">{row.event.note}</p>
              {/if}
              <p class="event-meta mt-2 text-xs text-[color:var(--ink2)]">
                Ngày gốc: {formatDate(parseDate(row.event.date))}
                {#if row.event.repeatAnnual && row.info.occ}
                  • Lần tới: {formatDate(row.info.occ)}
                {/if}
                {#if row.info.daysLeft !== null}
                  • {eventDistanceLabel(row.info)}
                {/if}
              </p>
            </div>

            <div class="event-actions">
              <button class="btn btn-soft event-action-btn text-sm w-full sm:w-auto" type="button" on:click={() => openEditEventModal(row.event)}>Sửa</button>
              <button class="btn btn-soft event-action-btn text-sm !text-rose-600 w-full sm:w-auto" type="button" on:click={() => removeEvent(row.event)}>Xoá</button>
            </div>
          </div>
        </article>
      {/each}
    {/if}
  </div>
</section>

<ModalShell
  open={eventFormModalOpen}
  close={closeEventFormModal}
  labelledBy="eventFormModalTitle"
  preset="modal-preset-sm"
  maxWidth="max-w-2xl"
  cardClass="events-form-modal-card"
  bodyClass="events-form-body px-4 py-4"
  showCancelAction={true}
  showPrimaryAction={true}
  cancelLabel="Huỷ"
  primaryLabel={editingId ? "Lưu chỉnh sửa" : "Thêm ngày đặc biệt"}
  primaryType="submit"
  primaryForm="eventForm"
>
  <div slot="header">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Ngày đặc biệt</p>
      <h3 id="eventFormModalTitle" class="text-lg font-bold text-[color:var(--ink)]">
        {editingId ? "Sửa sự kiện" : "Thêm ngày đặc biệt"}
      </h3>
    </div>
    <!-- <button type="button" class="btn btn-soft text-sm" on:click={closeEventFormModal}>Đóng</button> -->
  </div>

  <form id="eventForm" class="space-y-3" on:submit|preventDefault={submitForm}>
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

  </form>
</ModalShell>

<ModalShell
  open={eventsModalOpen}
  close={closeEventsModal}
  labelledBy="eventsModalTitle"
  preset="modal-preset-gallery"
  maxWidth="max-w-4xl"
  cardClass="events-list-modal-card"
  headerClass="events-modal-head flex items-center justify-between border-b border-pink-100/70 px-4 py-3"
  bodyClass="events-modal-body max-h-[72vh] space-y-3 overflow-y-auto px-4 py-4"
  showCancelAction={true}
  showPrimaryAction={true}
  cancelLabel="Đóng"
  primaryLabel="+ Thêm"
  onPrimaryAction={() => openCreateEventModal({ closeListModal: true })}
>
  <div slot="header">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Ngày đặc biệt</p>
      <h3 id="eventsModalTitle" class="text-lg font-bold text-[color:var(--ink)]">Danh sách sự kiện</h3>
      <p class="mt-1 text-xs font-medium text-[color:var(--ink2)]">{countLabel}</p>
    </div>
  </div>

  <div>
      {#if displayRows.length === 0}
        <div class="rounded-2xl border border-white/70 bg-white/60 p-4 text-sm text-[color:var(--ink2)]">
          Chưa có sự kiện nào.
        </div>
      {:else}
        {#each displayRows as row (row.event.id)}
          <article class={`${eventCardClass(row.info)} event-card`}>
            <div class="event-card-layout">
              <div class="min-w-0">
                <div class="event-chip-row">
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
                <h3 class="event-title mt-2 font-bold text-[color:var(--ink)]">{row.event.title}</h3>
                {#if row.event.note}
                  <p class="event-note mt-1 text-sm text-[color:var(--ink2)]">{row.event.note}</p>
                {/if}
                <p class="event-meta mt-2 text-xs text-[color:var(--ink2)]">
                  Ngày gốc: {formatDate(parseDate(row.event.date))}
                  {#if row.event.repeatAnnual && row.info.occ}
                    • Lần tới: {formatDate(row.info.occ)}
                  {/if}
                  {#if row.info.daysLeft !== null}
                    • {eventDistanceLabel(row.info)}
                  {/if}
                </p>
              </div>

              <div class="event-actions">
                <button class="btn btn-soft event-action-btn text-sm w-full sm:w-auto" type="button" on:click={() => openEditEventModal(row.event, { closeListModal: true })}>
                  Sửa
                </button>
                <button class="btn btn-soft event-action-btn text-sm !text-rose-600 w-full sm:w-auto" type="button" on:click={() => removeEvent(row.event)}>Xoá</button>
              </div>
            </div>
          </article>
        {/each}
      {/if}
  </div>
</ModalShell>

<style>
  .events-section {
    container-type: inline-size;
  }

  .events-head {
    display: grid;
    gap: 0.75rem;
  }

  .events-quick-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .events-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .events-toolbar-controls {
    display: grid;
    gap: 0.5rem;
    width: 100%;
  }

  .events-toolbar-main {
    width: 100%;
  }

  .events-toolbar-meta {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;
    width: 100%;
  }

  .events-toolbar-actions {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
    align-items: center;
    width: 100%;
  }

  .event-toolbar-btn {
    min-height: 2.5rem;
  }

  .events-count-pill {
    min-height: 2.5rem;
    justify-content: center;
    white-space: nowrap;
  }

  .events-toolbar-controls .events-count-pill {
    width: 100%;
  }

  .events-toolbar-actions .events-count-pill {
    width: 100%;
  }

  .event-more-btn {
    width: 100%;
    position: relative;
    padding-inline-start: 1rem;
    padding-inline-end: 2.1rem;
  }

  .event-more-badge {
    position: absolute;
    inset-block-start: 0.35rem;
    inset-inline-end: 0.45rem;
  }

  .event-card-layout {
    display: grid;
    gap: 0.75rem;
  }

  .event-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .event-title {
    font-size: clamp(1rem, 0.95rem + 0.25cqi, 1.125rem);
    line-height: 1.25;
    word-break: break-word;
  }

  .event-note {
    overflow-wrap: anywhere;
  }

  .event-meta {
    line-height: 1.45;
  }

  .event-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    align-items: start;
  }

  .event-action-btn {
    min-height: 2.5rem;
  }

  .events-modal-head {
    gap: 0.75rem;
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .events-modal-body {
    scroll-padding-block: 0.75rem;
    padding-bottom: max(1rem, calc(env(safe-area-inset-bottom) + 0.65rem)) !important;
  }

  .events-form-body {
    max-height: min(76vh, calc(100dvh - 8rem));
    overflow-y: auto;
    padding-bottom: max(1rem, calc(env(safe-area-inset-bottom) + 0.65rem)) !important;
    scroll-padding-bottom: max(1rem, calc(env(safe-area-inset-bottom) + 0.65rem));
  }

  .events-form-modal-card,
  .events-list-modal-card {
    padding-bottom: max(0.3rem, env(safe-area-inset-bottom));
  }

  @container (min-width: 30rem) {
    .events-toolbar-controls {
      grid-template-columns: auto auto;
      justify-content: end;
      width: auto;
    }

    .events-toolbar-main {
      width: auto;
    }

    .events-toolbar-meta {
      grid-template-columns: auto auto;
      align-items: center;
      width: auto;
    }

    .events-toolbar-controls .events-count-pill {
      width: auto;
      min-width: 6.5rem;
    }

    .event-more-btn {
      width: auto;
      padding-inline-start: 1rem;
      padding-inline-end: 2rem;
    }

    .events-toolbar-actions {
      grid-template-columns: repeat(3, minmax(0, max-content));
      justify-content: end;
      width: auto;
    }

    .events-toolbar-actions .events-count-pill {
      width: auto;
      min-width: 6.5rem;
    }

    .event-card-layout {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      gap: 0.75rem 1rem;
    }

    .event-actions {
      grid-auto-flow: column;
      grid-template-columns: repeat(2, minmax(0, max-content));
      justify-content: end;
    }

    .event-actions .btn {
      width: auto;
    }
  }

  @container (min-width: 42rem) {
    .events-head {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: end;
      gap: 1rem;
    }

    .events-quick-actions {
      grid-template-columns: repeat(3, minmax(7.5rem, 1fr));
    }

    .events-modal-head {
      flex-wrap: nowrap;
      align-items: center;
    }
  }

  @container (max-width: 24rem) {
    .events-toolbar-meta {
      grid-template-columns: minmax(0, 1fr);
    }

    .events-toolbar-controls .events-count-pill,
    .event-more-btn {
      width: 100%;
    }

    .event-actions {
      grid-template-columns: 1fr;
    }
  }

  @media (min-width: 640px) {
    .events-form-body {
      max-height: 78vh;
    }
  }
</style>
