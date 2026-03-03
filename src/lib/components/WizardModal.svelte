<script>
  import { createEventDispatcher } from "svelte";
  import { parseDateTime } from "../lingo/utils.js";
  import ModalShell from "./ModalShell.svelte";

  export let open = false;
  export let required = false;
  export let state;
  export let actions;
  export let toast = (msg) => console.log(msg);

  const dispatch = createEventDispatcher();

  let startDate = "";
  let errorText = "";
  let busy = false;
  let lastHydrated = "";

  function hydrateFromState() {
    startDate = state?.settings?.startDate || "";
    errorText = "";
  }

  $: canCloseWizard = !required || !!parseDateTime(startDate);

  $: if (open) {
    const sig = String(state?.settings?.startDate || "");
    if (sig !== lastHydrated) {
      hydrateFromState();
      lastHydrated = sig;
    }
  }

  function handleKeydown(event) {
    if (!open) return;
    if (event.key === "Escape") requestClose();
  }

  async function requestClose() {
    if (busy) return;
    if (!canCloseWizard) {
      errorText = "Vui lòng nhập ngày bắt đầu yêu trước khi đóng Wizard.";
      return;
    }
    dispatch("close");
  }

  async function finish() {
    errorText = "";
    busy = true;
    try {
      if (!parseDateTime(startDate)) throw new Error("Ngày bắt đầu yêu không hợp lệ.");
      await actions.saveStartDate(startDate);
      toast("Đã lưu ngày bắt đầu yêu.");
      dispatch("complete");
      dispatch("close");
    } catch (err) {
      errorText = err?.message || "Không thể hoàn tất Wizard.";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<ModalShell
  open={open}
  close={requestClose}
  labelledBy="wizardTitle"
  preset="modal-preset-form"
  cardStyle="max-width: 34rem;"
  showCancelAction={true}
  showPrimaryAction={true}
  cancelLabel="Để sau"
  primaryLabel={busy ? "Đang lưu..." : "Hoàn tất"}
  cancelDisabled={!canCloseWizard && required}
  cancelClass={`btn btn-soft text-sm ${!canCloseWizard ? "wizard-close-lock" : ""}`}
  primaryDisabled={busy}
  onPrimaryAction={finish}
  footerClass="flex items-center justify-end gap-2 border-t border-pink-100/70 px-4 py-3 sm:px-5"
>
  <div slot="header" class="flex items-center justify-between">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Wizard nhanh</p>
      <h2 id="wizardTitle" class="text-lg font-bold text-[color:var(--ink)]">Thiết lập ngày bắt đầu yêu</h2>
    </div>
    <button
      type="button"
      class={`btn btn-soft text-sm ${!canCloseWizard ? "wizard-close-lock" : ""}`}
      on:click={requestClose}
      disabled={!canCloseWizard && required}
    >
      Đóng
    </button>
  </div>

  <div>
    <p class="text-sm text-[color:var(--ink2)]">
      Bước này chỉ cần ngày bắt đầu yêu. Hồ sơ cá nhân của mỗi người sẽ lấy từ thông tin đăng ký.
    </p>

    <section class="mt-4 rounded-2xl border border-white/70 bg-white/70 p-4">
      <label class="label block" for="wiz_start_date">Ngày bắt đầu yêu</label>
      <input id="wiz_start_date" class="field mt-1 text-sm" type="datetime-local" bind:value={startDate} />
    </section>

    {#if errorText}
      <p class="mt-4 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
        {errorText}
      </p>
    {/if}
  </div>

</ModalShell>
