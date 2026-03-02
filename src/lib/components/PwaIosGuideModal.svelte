<script>
  import { createEventDispatcher } from "svelte";

  export let open = false;

  const dispatch = createEventDispatcher();

  function closeModal() {
    dispatch("close");
  }

  function onKeydown(event) {
    if (!open) return;
    if (event.key === "Escape") closeModal();
  }
</script>

<svelte:window on:keydown={onKeydown} />

<div class={`modal ${open ? "open" : ""}`} aria-hidden={!open} on:click|self={closeModal}>
  <div class="modal-card max-w-md" role="dialog" aria-modal="true" aria-labelledby="iosInstallTitle" tabindex="-1">
    <div class="border-b border-pink-100/70 px-4 py-3">
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Cài trên iPhone</p>
      <h3 id="iosInstallTitle" class="text-lg font-bold text-[color:var(--ink)]">Thêm Lingo vào màn hình chính</h3>
    </div>

    <div class="space-y-3 px-4 py-4 text-sm text-[color:var(--ink)]">
      <p>1. Mở menu <strong>Share</strong> trong Safari.</p>
      <p>2. Chọn <strong>Add to Home Screen</strong>.</p>
      <p>3. Nhấn <strong>Add</strong> để cài ứng dụng.</p>
      <p class="rounded-xl border border-pink-100/80 bg-pink-50/70 px-3 py-2 text-xs text-[color:var(--ink2)]">
        Mẹo: đăng nhập trước khi thêm để lần mở đầu giữ đúng phiên của bạn.
      </p>
    </div>

    <div class="flex justify-end border-t border-pink-100/70 px-4 py-3">
      <button type="button" class="btn btn-primary text-sm" on:click={closeModal}>Đã hiểu</button>
    </div>
  </div>
</div>
