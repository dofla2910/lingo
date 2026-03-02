<script>
  import { createEventDispatcher } from "svelte";
  import { fade } from "svelte/transition";
  import { countdownLabel, formatDateTime, isUnlocked } from "$lib/lingo/timeCapsuleUtils.js";
  import ModalShell from "./ModalShell.svelte";

  export let open = false;
  export let capsule = null;
  export let now = Date.now();

  const dispatch = createEventDispatcher();
  $: activeLocked = capsule ? !isUnlocked(capsule, now) : false;

  function closeModal() {
    dispatch("close");
  }
</script>

{#if capsule}
  <ModalShell
    open={open}
    close={closeModal}
    labelledBy="capsuleReaderTitle"
    preset="modal-preset-form"
    maxWidth="max-w-3xl"
    showActions={true}
    showCancelAction={false}
    primaryLabel="Đóng"
    onPrimaryAction={closeModal}
  >
    <div slot="header">
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Hộp thư</p>
      <h3 id="capsuleReaderTitle" class="text-lg font-bold text-[color:var(--ink)]">{capsule.title}</h3>
    </div>

    <p class="text-xs text-[color:var(--ink2)]">Mở vào: {formatDateTime(capsule.unlock_at)}</p>

    <div class="relative mt-3 overflow-hidden rounded-2xl border border-pink-100/80 bg-white/85">
      {#if capsule.image_url}
        <img
          src={capsule.image_url}
          alt={capsule.title}
          class={`max-h-[52vh] w-full object-contain ${activeLocked ? "blur-md scale-[1.03]" : ""}`}
          transition:fade={{ duration: 260 }}
        />
      {:else}
        <div class={`h-56 w-full bg-gradient-to-br from-pink-100/70 via-rose-50 to-pink-200/70 ${activeLocked ? "blur-[2px]" : ""}`}></div>
      {/if}

      {#if activeLocked}
        <div class="absolute inset-0 flex items-center justify-center bg-black/15 backdrop-blur-md">
          <div class="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-center">
            <p class="text-sm font-semibold text-[color:var(--ink)]">🔒 Chưa đến thời gian mở</p>
            <p class="mt-1 text-lg font-extrabold tracking-wider text-pink-600">{countdownLabel(capsule.unlock_at, now)}</p>
            <p class="mt-1 text-xs text-[color:var(--ink2)]">Ngày : Giờ : Phút : Giây</p>
          </div>
        </div>
      {/if}
    </div>

    <div class="mt-3 rounded-2xl border border-pink-100/80 bg-white/80 p-4">
      {#if activeLocked}
        <div class="relative overflow-hidden rounded-xl border border-white/80 bg-white/70 p-3">
          <div class="select-none text-[color:var(--ink2)] blur-md">
            {capsule.message}
          </div>
          <div class="absolute inset-0 bg-white/20"></div>
        </div>
      {:else}
        <div transition:fade={{ duration: 320 }}>
          <p class="whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--ink)]">{capsule.message}</p>
        </div>
      {/if}
    </div>
  </ModalShell>
{/if}
