<script>
  import { createEventDispatcher } from "svelte";

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

<div class={`modal ${open ? "open" : ""}`} aria-hidden={!open} on:click|self={closeModal}>
  <div class="modal-card max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="capsuleCreateTitle" tabindex="-1">
    <div class="flex items-center justify-between border-b border-pink-100/70 px-4 py-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Time Capsule</p>
        <h3 id="capsuleCreateTitle" class="text-lg font-bold text-[color:var(--ink)]">Tạo Hộp thư thời gian</h3>
      </div>
      <button class="btn btn-soft text-sm" type="button" on:click={closeModal} disabled={saving}>Đóng</button>
    </div>

    <form class="space-y-3 px-4 py-4" on:submit|preventDefault={submitForm}>
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

      <div class="flex flex-wrap justify-end gap-2 border-t border-pink-100/70 pt-3">
        <button class="btn btn-soft text-sm min-h-[40px]" type="button" on:click={closeModal} disabled={saving}>
          Huỷ
        </button>
        <button class="btn btn-primary text-sm min-h-[40px]" type="submit" disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu Time Capsule"}
        </button>
      </div>
    </form>
  </div>
</div>
