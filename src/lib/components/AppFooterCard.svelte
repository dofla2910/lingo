<script>
  import { createEventDispatcher } from "svelte";
  import PwaInstallButton from "./PwaInstallButton.svelte";

  const dispatch = createEventDispatcher();

  function handleToast(event) {
    dispatch("toast", event.detail);
  }
</script>

<footer class="card rounded-2xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div class="text-sm text-[color:var(--ink2)]">
    <p class="font-semibold text-[color:var(--ink)]">Riêng tư & cài đặt</p>
    <p>Dữ liệu được lưu trong phòng chung của hai bạn và đồng bộ giữa các thiết bị đã ghép cặp.</p>
  </div>
  <div class="flex flex-wrap gap-2">
    <PwaInstallButton buttonClass="btn btn-soft text-sm" label="Cài ứng dụng" on:toast={handleToast} />
    <button class="btn btn-soft text-sm" type="button" on:click={() => dispatch("opensettings")}>Mở cài đặt</button>
    <button class="btn btn-primary text-sm" type="button" on:click={() => dispatch("openwizard")}>Wizard nhanh</button>
  </div>
</footer>
