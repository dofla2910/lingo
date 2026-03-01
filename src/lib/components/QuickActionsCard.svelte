<script>
  import { createEventDispatcher } from "svelte";
  import PwaInstallButton from "./PwaInstallButton.svelte";

  export let hasRoom = false;
  export let roomId = "";
  export let twoColumn = false;

  const dispatch = createEventDispatcher();

  function handleToast(event) {
    dispatch("toast", event.detail);
  }
</script>

<section class="card quick-actions-card rounded-3xl p-3 sm:p-4" aria-label="Kết nối & cài đặt">
  <div class="mb-3">
    <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Điều khiển nhanh</p>
    <h3 class="text-base font-bold leading-tight text-[color:var(--ink)]">Kết nối & cài đặt</h3>
  </div>
  <div class={`quick-actions-grid ${twoColumn ? "quick-actions-grid--two" : ""}`}>
    <button
      class={`btn text-sm w-full min-h-[44px] ${hasRoom ? "btn-soft" : "btn-primary"}`}
      type="button"
      on:click={() => dispatch("openpairing")}
    >
      {hasRoom ? `Phòng ${roomId}` : "Kết nối cặp đôi"}
    </button>
    <button class="btn btn-soft text-sm w-full min-h-[44px]" type="button" on:click={() => dispatch("opensettings")}>Cài đặt</button>
    <button class="btn btn-primary text-sm w-full min-h-[44px]" type="button" on:click={() => dispatch("openwizard")}>Wizard nhanh</button>
    <PwaInstallButton
      buttonClass="btn btn-soft text-sm w-full min-h-[44px]"
      label="Cài ứng dụng"
      compact={true}
      on:toast={handleToast}
    />
  </div>
</section>

<style>
  .quick-actions-card {
    container-type: inline-size;
  }

  .quick-actions-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  @container (min-width: 24rem) {
    .quick-actions-grid--two {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
