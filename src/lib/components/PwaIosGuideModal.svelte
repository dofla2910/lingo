<script>
  import { createEventDispatcher } from "svelte";
  import ModalShell from "./ModalShell.svelte";

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

<ModalShell
  open={open}
  close={closeModal}
  labelledBy="iosInstallTitle"
  preset="modal-preset-sm"
  maxWidth="max-w-md"
  showActions={true}
  showCancelAction={false}
  primaryLabel="Đã hiểu"
  onPrimaryAction={closeModal}
>
  <div slot="header">
    <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Cài trên iPhone</p>
    <h3 id="iosInstallTitle" class="text-lg font-bold text-[color:var(--ink)]">Thêm Lingo vào màn hình chính</h3>
  </div>

  <div class="space-y-3 text-sm text-[color:var(--ink)]">
    <p>1. Mở menu <strong>Share</strong> trong Safari.</p>
    <p>2. Chọn <strong>Add to Home Screen</strong>.</p>
    <p>3. Nhấn <strong>Add</strong> để cài ứng dụng.</p>
    <p class="rounded-xl border border-pink-100/80 bg-pink-50/70 px-3 py-2 text-xs text-[color:var(--ink2)]">
      Mẹo: đăng nhập trước khi thêm để lần mở đầu giữ đúng phiên của bạn.
    </p>
  </div>
</ModalShell>
