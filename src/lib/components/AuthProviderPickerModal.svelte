<script>
  import { createEventDispatcher } from "svelte";
  import ModalShell from "./ModalShell.svelte";

  export let open = false;
  export let authBusy = false;
  export let pairBusy = false;
  export let providers = [];
  export let pendingAutoPairAfterAuth = false;
  export let providerPickerReason = "";
  export let providerName = () => "";
  export let providerIcon = () => "🔐";
  export let providerHint = () => "";
  export let providerAccent = () => "";

  const dispatch = createEventDispatcher();

  function closeModal() {
    if (authBusy) return;
    dispatch("close");
  }

  function chooseProvider(providerId) {
    dispatch("chooseprovider", providerId);
  }
</script>

<ModalShell
  open={open}
  close={closeModal}
  labelledBy="providerPickerTitle"
  preset="modal-preset-form"
  cardStyle="max-width: 46rem;"
>
  <div slot="header" class="flex items-center justify-between">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Đăng nhập</p>
      <h3 id="providerPickerTitle" class="text-lg font-bold text-[color:var(--ink)]">Chọn tài khoản để tiếp tục</h3>
    </div>
    <!-- <button type="button" class="btn btn-soft text-sm" on:click={closeModal} disabled={authBusy}>Đóng</button> -->
  </div>

  <div>
    <div class="rounded-2xl border border-white/70 bg-white/65 p-4">
      <div class="flex flex-wrap items-center gap-2">
        <span class="pill">Đăng nhập nhanh</span>
        {#if pendingAutoPairAfterAuth}
          <span class="pill">Tự tạo mã sau đăng nhập</span>
        {/if}
      </div>
      <p class="mt-2 text-sm text-[color:var(--ink2)]">
        {#if pendingAutoPairAfterAuth}
          Sau khi đăng nhập xong và quay lại trang, Lingo sẽ tự tạo mã ghép cặp 6 ký tự cho bạn.
        {:else}
          Chọn một tài khoản để đăng nhập và tiếp tục ghép cặp.
        {/if}
      </p>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {#each providers as provider}
        <button
          type="button"
          class="group relative overflow-hidden rounded-2xl border border-white/80 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 min-h-[112px]"
          on:click={() => chooseProvider(provider.id)}
          disabled={authBusy || pairBusy}
        >
          <div class={`pointer-events-none absolute inset-0 bg-gradient-to-br ${providerAccent(provider.id)}`}></div>
          <div class="relative">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="h-11 w-11 rounded-xl border border-white/90 bg-white/90 flex items-center justify-center text-xl shadow-sm shrink-0">
                  {providerIcon(provider.id)}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-bold text-[color:var(--ink)] truncate">{providerName(provider.id, provider.name)}</p>
                  <p class="text-xs text-[color:var(--ink2)]">Đăng nhập</p>
                </div>
              </div>
              <span class="pill text-[11px] shrink-0">Chọn</span>
            </div>
            <p class="mt-3 text-xs leading-5 text-[color:var(--ink2)]">
              {providerHint(provider.id)}
            </p>
          </div>
        </button>
      {/each}
    </div>

    {#if providerPickerReason === "wizard-auto"}
      <p class="mt-4 rounded-xl border border-pink-200/80 bg-pink-50/80 px-3 py-2 text-sm text-pink-700">
        Wizard đã hoàn tất. Bước tiếp theo là đăng nhập để hệ thống tự tạo mã ghép cặp cho hai bạn.
      </p>
    {/if}
  </div>
</ModalShell>
