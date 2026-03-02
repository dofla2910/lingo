<script>
  import { createEventDispatcher } from "svelte";
  import ModalShell from "./ModalShell.svelte";

  export let open = false;
  export let saving = false;
  export let title = "";
  export let message = "";
  export let unlockAtLocal = "";
  export let minUnlockAtLocal = "";
  export let previewUrl = "";
  export let fileInputRef;

  const dispatch = createEventDispatcher();

  function closeModal() {
    dispatch("close");
  }

  function submitForm() {
    dispatch("submit");
  }

  function handleFileChange(event) {
    dispatch("filechange", event);
  }
</script>

<ModalShell
  open={open}
  close={closeModal}
  labelledBy="capsuleCreateTitle"
  preset="modal-preset-form"
  maxWidth="max-w-2xl"
  showActions={true}
  cancelLabel="Huỷ"
  primaryLabel={saving ? "Đang lưu..." : "Lưu Time Capsule"}
  primaryType="submit"
  primaryForm="timeCapsuleCreateForm"
  cancelDisabled={saving}
  primaryDisabled={saving}
>
  <div slot="header" class="flex items-center justify-between">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Time Capsule</p>
      <h3 id="capsuleCreateTitle" class="text-lg font-bold text-[color:var(--ink)]">Tạo Hộp thư thời gian</h3>
    </div>
    <button class="btn btn-soft text-sm" type="button" on:click={closeModal} disabled={saving}>Đóng</button>
  </div>

  <form id="timeCapsuleCreateForm" class="space-y-3" on:submit|preventDefault={submitForm}>
    <div>
      <label class="label" for="capsule_title">Tiêu đề</label>
      <input
        id="capsule_title"
        class="field mt-1 text-sm"
        type="text"
        maxlength="120"
        bind:value={title}
        placeholder="Ví dụ: Lá thư cho kỷ niệm 2 năm"
        disabled={saving}
      />
    </div>

    <div>
      <label class="label" for="capsule_message">Nội dung</label>
      <textarea
        id="capsule_message"
        class="field mt-1 min-h-[120px] text-sm"
        maxlength="2000"
        bind:value={message}
        placeholder="Viết lời nhắn gửi cho tương lai..."
        disabled={saving}
      ></textarea>
    </div>

    <div>
      <label class="label" for="capsule_unlock_at">Thời điểm mở (ngày + giờ chính xác)</label>
      <input
        id="capsule_unlock_at"
        class="field mt-1 text-sm"
        type="datetime-local"
        bind:value={unlockAtLocal}
        min={minUnlockAtLocal}
        disabled={saving}
      />
    </div>

    <div>
      <label class="label" for="capsule_image">Ảnh đính kèm (tuỳ chọn)</label>
      <input
        id="capsule_image"
        bind:this={fileInputRef}
        class="field mt-1 text-sm"
        type="file"
        accept="image/*"
        capture="environment"
        on:change={handleFileChange}
        disabled={saving}
      />
    </div>

    {#if previewUrl}
      <div class="overflow-hidden rounded-2xl border border-pink-100/80 bg-white/80 p-2">
        <img src={previewUrl} alt="Xem trước ảnh time capsule" class="max-h-52 w-full object-contain" />
      </div>
    {/if}

  </form>
</ModalShell>
