<script>
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher();
</script>

<section class="card rounded-3xl p-4 sm:p-5">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Bắt đầu thiết lập</p>
      <h2 class="text-lg sm:text-xl font-bold text-[color:var(--ink)]">Wizard thiết lập nhanh</h2>
      <p class="text-sm text-[color:var(--ink2)]">
        Hoàn tất thông tin cặp đôi và bắt đầu đếm ngày yêu chỉ trong vài bước.
      </p>
    </div>
    <div class="grid grid-cols-1 gap-2 w-full sm:w-auto sm:min-w-[180px]">
      <button class="btn btn-primary text-sm w-full" type="button" on:click={() => dispatch("openwizard")}>Mở Wizard</button>
    </div>
  </div>
</section>
