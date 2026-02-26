<script>
  import { createEventDispatcher } from "svelte";
  import PersonEditorCard from "./PersonEditorCard.svelte";
  import { normalizePerson } from "../lingo/schema.js";
  import { parseDate, parseDateTime, resizeAvatarFile } from "../lingo/utils.js";

  export let open = false;
  export let required = false;
  export let state;
  export let actions;
  export let toast = (msg) => console.log(msg);

  const dispatch = createEventDispatcher();

  let step = 0;
  let startDate = "";
  let personA = emptyDraft();
  let personB = emptyDraft();
  let errorText = "";
  let busy = false;
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

  function signatureForState() {
    const s = state || {};
    return JSON.stringify({
      startDate: s?.settings?.startDate || "",
      a: s?.couple?.personA || {},
      b: s?.couple?.personB || {},
    });
  }

  function hydrateFromState() {
    step = 0;
    startDate = state?.settings?.startDate || "";
    personA = toDraft(state?.couple?.personA);
    personB = toDraft(state?.couple?.personB);
    errorText = "";
  }

  $: canCloseWizard = !required || !!parseDateTime(startDate);

  $: if (open) {
    const sig = signatureForState();
    if (sig !== lastHydratedSignature) {
      hydrateFromState();
      lastHydratedSignature = sig;
    }
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

  function validateStep() {
    if (step === 0 && !parseDateTime(startDate)) {
      throw new Error("Vui lòng chọn ngày bắt đầu yêu hợp lệ.");
    }
    if (step === 1 && personA.birthday && !parseDate(personA.birthday)) {
      throw new Error("Ngày sinh của Người 1 không hợp lệ.");
    }
    if (step === 2 && personB.birthday && !parseDate(personB.birthday)) {
      throw new Error("Ngày sinh của Người 2 không hợp lệ.");
    }
  }

  function nextStep() {
    errorText = "";
    try {
      validateStep();
      if (step < 2) step += 1;
    } catch (err) {
      errorText = err?.message || "Thông tin chưa hợp lệ.";
    }
  }

  function prevStep() {
    errorText = "";
    if (step > 0) step -= 1;
  }

  async function requestClose() {
    if (busy) return;
    if (!canCloseWizard) {
      errorText = "Hoàn tất bước ngày bắt đầu yêu trước khi đóng Wizard.";
      toast("Hoàn tất bước ngày bắt đầu yêu trước khi đóng Wizard.");
      return;
    }
    if (required && parseDateTime(startDate) && !(state?.settings?.startDate || "").trim()) {
      try {
        await actions.saveStartDate(startDate);
        toast("Đã lưu tạm ngày bắt đầu yêu. Bạn có thể bổ sung hồ sơ sau.");
      } catch (err) {
        errorText = err?.message || "Không thể lưu tạm dữ liệu.";
        return;
      }
    }
    dispatch("close");
  }

  async function finish() {
    errorText = "";
    busy = true;
    try {
      if (!parseDateTime(startDate)) throw new Error("Ngày bắt đầu yêu không hợp lệ.");
      if (personA.birthday && !parseDate(personA.birthday)) throw new Error("Ngày sinh của Người 1 không hợp lệ.");
      if (personB.birthday && !parseDate(personB.birthday)) throw new Error("Ngày sinh của Người 2 không hợp lệ.");

      await actions.saveCoupleSettings({
        startDate,
        personA: composePerson(state?.couple?.personA, personA, "a"),
        personB: composePerson(state?.couple?.personB, personB, "b"),
      });
      toast("Hoàn tất thiết lập Lingo.");
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

<div class={`modal ${open ? "open" : ""}`} aria-hidden={!open} on:click|self={requestClose}>
  <div
    class="modal-card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="wizardTitle"
    tabindex="-1"
  >
    <div class="flex items-center justify-between border-b border-pink-100/70 px-4 py-3 sm:px-5">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Wizard nhanh</p>
        <h2 id="wizardTitle" class="text-lg font-bold text-[color:var(--ink)]">Thiết lập hồ sơ tình yêu Lingo</h2>
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

    <div class="max-h-[78vh] overflow-y-auto px-4 py-4 sm:px-5">
      <div class="wizard-inline-note flex items-start gap-2 text-sm text-[color:var(--ink2)]">
        <span class="mt-0.5" aria-hidden="true">🦩</span>
        <p>
          Tình yêu bền vững như loài Hạc (chung thủy trọn đời) và rực rỡ như hoa Tulip (tình yêu hoàn hảo).
          {#if required}
            Hãy nhập ít nhất ngày bắt đầu yêu để bắt đầu bộ đếm.
          {/if}
        </p>
      </div>

      <div class="mt-4 flex items-center justify-center gap-2">
        {#each [0,1,2] as idx}
          <span class={`wiz-dot ${step === idx ? "active" : ""} ${step > idx ? "done" : ""}`}></span>
        {/each}
      </div>

      {#if step === 0}
        <section class="mt-4 rounded-2xl border border-white/70 bg-white/70 p-4">
          <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Bước 1</p>
          <h3 class="mt-1 text-lg font-bold text-[color:var(--ink)]">Ngày bắt đầu yêu</h3>
          <label class="label mt-4 block" for="wiz_start_date">Chọn ngày & giờ</label>
          <input id="wiz_start_date" class="field mt-1 text-sm" type="datetime-local" bind:value={startDate} />
          <p class="mt-2 text-sm text-[color:var(--ink2)]">
            Dữ liệu sẽ lưu vào phòng chung hiện tại. Bạn có thể sửa lại trong Cài đặt bất kỳ lúc nào.
          </p>
        </section>
      {:else if step === 1}
        <div class="mt-4">
          <PersonEditorCard
            title="Người 1"
            idPrefix="wizard_a"
            bind:draft={personA}
            on:avatar-file={(e) => onAvatarFile("a", e.detail.file)}
          />
        </div>
      {:else}
        <div class="mt-4">
          <PersonEditorCard
            title="Người 2"
            idPrefix="wizard_b"
            bind:draft={personB}
            on:avatar-file={(e) => onAvatarFile("b", e.detail.file)}
          />
        </div>
      {/if}

      {#if errorText}
        <p class="mt-4 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
          {errorText}
        </p>
      {/if}
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2 border-t border-pink-100/70 px-4 py-3 sm:px-5">
      <button
        type="button"
        class={`btn btn-soft text-sm ${!canCloseWizard ? "wizard-close-lock" : ""}`}
        on:click={requestClose}
        disabled={!canCloseWizard && required}
      >
        Để sau
      </button>

      <div class="flex gap-2">
        <button type="button" class="btn btn-soft text-sm" on:click={prevStep} disabled={step === 0}>Quay lại</button>
        {#if step < 2}
          <button type="button" class="btn btn-primary text-sm" on:click={nextStep}>Tiếp tục</button>
        {:else}
          <button type="button" class="btn btn-primary text-sm" on:click={finish} disabled={busy}>
            {busy ? "Đang lưu..." : "Hoàn tất"}
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
