<script>
  import { createEventDispatcher } from "svelte";
  import { parseDateTime } from "../lingo/utils.js";

  export let open = false;
  export let state;
  export let actions;
  export let toast = (msg) => console.log(msg);

  const dispatch = createEventDispatcher();

  let startDate = "";
  let authPanelMode = "ultra_minimal";
  let errorText = "";
  let busy = false;
  let importInput;
  let lastHydratedSignature = "";

  function hydrateFromState() {
    startDate = state?.settings?.startDate || "";
    authPanelMode = state?.ui?.authPanelMode === "standard" ? "standard" : "ultra_minimal";
    errorText = "";
  }

  function signatureForState() {
    const s = state || {};
    return JSON.stringify({
      startDate: s?.settings?.startDate || "",
      authPanelMode: s?.ui?.authPanelMode || "ultra_minimal",
    });
  }

  $: if (open) {
    const sig = signatureForState();
    if (sig !== lastHydratedSignature) {
      hydrateFromState();
      lastHydratedSignature = sig;
    }
  }

  function requestClose() {
    if (busy) return;
    dispatch("close");
  }

  function handleKeydown(event) {
    if (!open) return;
    if (event.key === "Escape") requestClose();
  }

  async function save() {
    errorText = "";
    busy = true;
    try {
      if (startDate && !parseDateTime(startDate)) {
        throw new Error("Ngày bắt đầu yêu không hợp lệ.");
      }
      await actions.saveStartDate(startDate);
      await actions.setAuthPanelMode(authPanelMode);
      toast("Đã lưu cài đặt.");
      dispatch("saved");
      dispatch("close");
    } catch (err) {
      errorText = err?.message || "Không thể lưu cài đặt.";
    } finally {
      busy = false;
    }
  }

  function exportJson() {
    try {
      actions.exportJsonFile();
      toast("Đã xuất file JSON sao lưu.");
    } catch (err) {
      errorText = err?.message || "Không thể xuất JSON.";
    }
  }

  function triggerImport() {
    importInput?.click();
  }

  async function onImportChange(event) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const ok = confirm("Nhập JSON sẽ ghi đè dữ liệu hiện tại của phòng này. Tiếp tục?");
    if (!ok) return;
    try {
      const text = await file.text();
      await actions.importJsonText(text);
      toast("Đã nhập dữ liệu JSON.");
      dispatch("saved");
      dispatch("close");
    } catch (err) {
      errorText = err?.message || "Không thể nhập JSON.";
    }
  }

  async function resetAll() {
    const ok = confirm("Đặt lại toàn bộ dữ liệu phòng hiện tại?");
    if (!ok) return;
    try {
      await actions.resetAll();
      toast("Đã đặt lại dữ liệu.");
      dispatch("reset");
      dispatch("close");
    } catch (err) {
      errorText = err?.message || "Không thể đặt lại dữ liệu.";
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class={`modal ${open ? "open" : ""}`} aria-hidden={!open} on:click|self={requestClose}>
  <div
    class="modal-card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="settingsTitle"
    tabindex="-1"
  >
    <div class="flex items-center justify-between border-b border-pink-100/70 px-4 py-3 sm:px-5">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Cài đặt</p>
        <h2 id="settingsTitle" class="text-lg font-bold text-[color:var(--ink)]">Ngày bắt đầu & dữ liệu phòng</h2>
      </div>
      <button type="button" class="btn btn-soft text-sm" on:click={requestClose}>Đóng</button>
    </div>

    <div class="max-h-[78vh] overflow-y-auto px-4 py-4 sm:px-5">
      <div class="rounded-2xl border border-white/70 bg-white/65 p-4">
        <label class="label" for="svelte_start_date">Ngày bắt đầu yêu</label>
        <input id="svelte_start_date" class="field mt-1 text-sm" type="datetime-local" bind:value={startDate} />
        <p class="mt-2 text-xs text-[color:var(--ink2)]">
          Áp dụng cho toàn bộ phòng hiện tại.
        </p>
      </div>

      <div class="mt-4 rounded-2xl border border-white/70 bg-white/65 p-4">
        <p class="text-sm font-semibold text-[color:var(--ink)]">Hiển thị panel đăng nhập & ghép cặp</p>
        <p class="mt-1 text-xs text-[color:var(--ink2)]">Chọn kiểu gọn nhẹ hoặc đầy đủ thông tin.</p>
        <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label
            class={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
              authPanelMode === "ultra_minimal"
                ? "border-pink-300 bg-pink-50/80 shadow-sm shadow-pink-100"
                : "border-pink-100/70 bg-white/70 hover:border-pink-200"
            }`}
          >
            <input
              class="mt-1 h-4 w-4 accent-pink-500"
              type="radio"
              name="auth_panel_mode"
              value="ultra_minimal"
              bind:group={authPanelMode}
            />
            <span>
              <span class="block font-semibold text-[color:var(--ink)]">Siêu tối giản</span>
              <span class="block text-xs text-[color:var(--ink2)]">Tập trung thao tác nhanh.</span>
            </span>
          </label>

          <label
            class={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 text-sm transition ${
              authPanelMode === "standard"
                ? "border-pink-300 bg-pink-50/80 shadow-sm shadow-pink-100"
                : "border-pink-100/70 bg-white/70 hover:border-pink-200"
            }`}
          >
            <input
              class="mt-1 h-4 w-4 accent-pink-500"
              type="radio"
              name="auth_panel_mode"
              value="standard"
              bind:group={authPanelMode}
            />
            <span>
              <span class="block font-semibold text-[color:var(--ink)]">Tiêu chuẩn</span>
              <span class="block text-xs text-[color:var(--ink2)]">Hiển thị thêm thông tin chi tiết.</span>
            </span>
          </label>
        </div>
      </div>

      <div class="mt-4 rounded-2xl border border-white/70 bg-white/65 p-4">
        <p class="text-sm font-semibold text-[color:var(--ink)]">Sao lưu / khôi phục</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button type="button" class="btn btn-soft text-sm" on:click={exportJson}>Xuất dữ liệu JSON</button>
          <button type="button" class="btn btn-soft text-sm" on:click={triggerImport}>Nhập dữ liệu JSON</button>
          <button type="button" class="btn btn-danger text-sm" on:click={resetAll}>Đặt lại dữ liệu</button>
        </div>
        <input bind:this={importInput} type="file" accept="application/json,.json" class="hidden" on:change={onImportChange} />
      </div>

      {#if errorText}
        <p class="mt-4 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
          {errorText}
        </p>
      {/if}
    </div>

    <div class="flex justify-end gap-2 border-t border-pink-100/70 px-4 py-3 sm:px-5">
      <button type="button" class="btn btn-soft text-sm" on:click={requestClose}>Huỷ</button>
      <button type="button" class="btn btn-primary text-sm" on:click={save} disabled={busy}>
        {busy ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
    </div>
  </div>
</div>
