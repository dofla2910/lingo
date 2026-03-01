<script>
  import { createEventDispatcher } from "svelte";

  export let busy = false;

  const dispatch = createEventDispatcher();
</script>

<div class="pinterest-tile">
  <section class="card rounded-3xl p-4 sm:p-5" aria-live="polite">
    <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Kết nối dữ liệu</p>
    <h2 class="mt-2 text-lg sm:text-xl font-bold text-[color:var(--ink)]">Khởi tạo đang mất lâu hơn bình thường</h2>
    <p class="mt-2 text-sm text-[color:var(--ink2)]">
      Vui lòng kiểm tra mạng hoặc thử kết nối lại.
    </p>
    <div class="mt-4 flex flex-wrap gap-2">
      <button
        class="btn btn-primary text-sm min-h-[44px]"
        type="button"
        on:click={() => dispatch("retry")}
        disabled={busy}
      >
        {busy ? "Đang thử lại..." : "Thử lại"}
      </button>
      <button class="btn btn-soft text-sm min-h-[44px]" type="button" on:click={() => dispatch("openpairing")}>
        Mở ghép cặp
      </button>
    </div>
  </section>
</div>
