<script>
  import { createEventDispatcher } from "svelte";
  import PersonEditorCard from "./PersonEditorCard.svelte";
  import { normalizePerson } from "../lingo/schema.js";
  import { parseDate, parseDateTime, resizeAvatarFile } from "../lingo/utils.js";

  export let open = false;
  export let state;
  export let actions;
  export let toast = (msg) => console.log(msg);

  const dispatch = createEventDispatcher();

  let startDate = "";
  let authPanelMode = "ultra_minimal";
  let personA = emptyDraft();
  let personB = emptyDraft();
  let errorText = "";
  let busy = false;
  let importInput;
  let lastHydratedSignature = "";

  function emptyDraft() {
    return {
      name: "",
      birthday: "",
      gender: "khong_tiet_lo",
      avatarUrlInput: "",
      uploadedAvatarData: "",
      existingAvatarUrl: "",
      existingAvatarType: "default",
      useDefault: true,
    };
  }

  function toDraft(person) {
    const p = normalizePerson(person || {}, "x");
    const avatarUrlInput = p.avatarType === "url" ? (p.avatarSourceUrl || p.avatarUrl || "") : "";
    return {
      name: p.name || "",
      birthday: p.birthday || "",
      gender: p.gender || "khong_tiet_lo",
      avatarUrlInput,
      uploadedAvatarData: "",
      existingAvatarUrl: p.avatarUrl || "",
      existingAvatarType: p.avatarType || "default",
      useDefault: p.avatarType === "default" || !p.avatarUrl,
    };
  }

  function hydrateFromState() {
    startDate = state?.settings?.startDate || "";
    authPanelMode = state?.ui?.authPanelMode === "standard" ? "standard" : "ultra_minimal";
    personA = toDraft(state?.couple?.personA);
    personB = toDraft(state?.couple?.personB);
    errorText = "";
  }

  function signatureForState() {
    const s = state || {};
    return JSON.stringify({
      startDate: s?.settings?.startDate || "",
      authPanelMode: s?.ui?.authPanelMode || "ultra_minimal",
      a: s?.couple?.personA || {},
      b: s?.couple?.personB || {},
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

  async function onAvatarFile(which, file) {
    if (!file) return;
    try {
      const data = await resizeAvatarFile(file, 320);
      if (which === "a") {
        personA.uploadedAvatarData = data || "";
        personA.useDefault = false;
      } else {
        personB.uploadedAvatarData = data || "";
        personB.useDefault = false;
      }
    } catch (err) {
      errorText = err?.message || "Không thể xử lý ảnh.";
    }
  }

  function composePerson(existing, draft, fallbackId) {
    const prev = normalizePerson(existing || {}, fallbackId);
    const out = {
      ...prev,
      name: String(draft.name || "").trim(),
      birthday: String(draft.birthday || "").trim(),
      gender: draft.gender || "khong_tiet_lo",
    };

    if (draft.useDefault) {
      out.avatarType = "default";
      out.avatarUrl = "";
      out.avatarSourceUrl = "";
      return out;
    }
    if (draft.uploadedAvatarData) {
      out.avatarType = "upload";
      out.avatarUrl = draft.uploadedAvatarData;
      out.avatarSourceUrl = "";
      return out;
    }
    const url = String(draft.avatarUrlInput || "").trim();
    if (url) {
      out.avatarType = "url";
      out.avatarUrl = url;
      out.avatarSourceUrl = url;
      return out;
    }
    if (prev.avatarUrl) return out;
    out.avatarType = "default";
    out.avatarUrl = "";
    out.avatarSourceUrl = "";
    return out;
  }

  function validateForm() {
    if (startDate && !parseDateTime(startDate)) {
      throw new Error("Ngày bắt đầu yêu không hợp lệ.");
    }
    if (personA.birthday && !parseDate(personA.birthday)) {
      throw new Error("Ngày sinh của Người 1 không hợp lệ.");
    }
    if (personB.birthday && !parseDate(personB.birthday)) {
      throw new Error("Ngày sinh của Người 2 không hợp lệ.");
    }
  }

  async function save() {
    errorText = "";
    busy = true;
    try {
      validateForm();
      await actions.saveCoupleSettings({
        startDate,
        personA: composePerson(state?.couple?.personA, personA, "a"),
        personB: composePerson(state?.couple?.personB, personB, "b"),
        ui: { authPanelMode },
      });
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
    const ok = confirm("Nhập JSON sẽ ghi đè dữ liệu hiện tại của hai bạn. Tiếp tục?");
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
    const ok = confirm("Đặt lại toàn bộ dữ liệu Lingo của hai bạn?");
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
        <h2 id="settingsTitle" class="text-lg font-bold text-[color:var(--ink)]">Cập nhật hồ sơ & ngày bắt đầu</h2>
      </div>
      <button type="button" class="btn btn-soft text-sm" on:click={requestClose}>Đóng</button>
    </div>

    <div class="max-h-[78vh] overflow-y-auto px-4 py-4 sm:px-5">
      <div class="rounded-2xl border border-white/70 bg-white/65 p-4">
        <label class="label" for="svelte_start_date">Ngày bắt đầu yêu</label>
        <input id="svelte_start_date" class="field mt-1 text-sm" type="datetime-local" bind:value={startDate} />
        <p class="mt-2 text-xs text-[color:var(--ink2)]">
          Dữ liệu sẽ được lưu vào phòng chung hiện tại của hai bạn.
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
              <span class="block text-xs text-[color:var(--ink2)]">Tập trung thao tác nhanh, ít nội dung.</span>
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
              <span class="block text-xs text-[color:var(--ink2)]">Hiển thị thêm hướng dẫn và thông tin ghép cặp.</span>
            </span>
          </label>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <PersonEditorCard
          title="Người 1"
          idPrefix="settings_a"
          bind:draft={personA}
          on:avatar-file={(e) => onAvatarFile("a", e.detail.file)}
        />
        <PersonEditorCard
          title="Người 2"
          idPrefix="settings_b"
          bind:draft={personB}
          on:avatar-file={(e) => onAvatarFile("b", e.detail.file)}
        />
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
