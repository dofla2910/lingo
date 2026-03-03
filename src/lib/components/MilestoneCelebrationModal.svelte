<script>
  import { createEventDispatcher } from "svelte";
  import { formatDateTime } from "../lingo/utils.js";
  import ModalShell from "./ModalShell.svelte";

  export let open = false;
  export let milestone = null;
  export let queueCount = 0;

  const dispatch = createEventDispatcher();

  function closeModal() {
    dispatch("close");
  }

  function handleKeydown(event) {
    if (!open) return;
    if (event.key === "Escape") closeModal();
  }

  function hashSeed(value) {
    let h = 2166136261;
    const str = String(value || "");
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) || 1;
  }

  function seeded(seed) {
    let x = seed >>> 0;
    return () => {
      x = (1664525 * x + 1013904223) >>> 0;
      return x / 4294967296;
    };
  }

  function buildPieces(id) {
    const rand = seeded(hashSeed(id));
    const symbols = ["♥", "♡", "✦", "🦩"];
    return Array.from({ length: 20 }, (_, idx) => {
      const angle = rand() * Math.PI * 2;
      const radius = 40 + rand() * 120;
      const tx = `${Math.cos(angle) * radius}px`;
      const ty = `${Math.sin(angle) * radius}px`;
      const rot = `${Math.round((rand() - 0.5) * 220)}deg`;
      const delay = `${Math.round(rand() * 220)}ms`;
      const size = `${16 + Math.round(rand() * 10)}px`;
      const symbol = symbols[idx % symbols.length];
      return { idx, tx, ty, rot, delay, size, symbol };
    });
  }

  $: pieces = buildPieces(milestone?.id || "none");
</script>

<svelte:window on:keydown={handleKeydown} />

<ModalShell
  open={open}
  close={closeModal}
  labelledBy="celebrateTitle"
  preset="modal-preset-sm"
  maxWidth="max-w-xl"
  bodyClass="modal-body relative overflow-hidden px-5 py-5 sm:px-6 sm:py-6"
  showCancelAction={false}
  showPrimaryAction={true}
  primaryLabel="Yay!"
  onPrimaryAction={closeModal}
>
  <div class="cele-wrap" aria-hidden="true">
    {#each pieces as piece (piece.idx)}
      <span
        class="cele-piece"
        style={`--tx:${piece.tx};--ty:${piece.ty};--rot:${piece.rot};animation-delay:${piece.delay};font-size:${piece.size};`}
      >
        {piece.symbol}
      </span>
    {/each}
  </div>

  <div class="relative z-[1]">
    <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Chúc mừng</p>
    <h2 id="celebrateTitle" class="mt-1 text-xl sm:text-2xl font-extrabold text-[color:var(--ink)]">
      {milestone ? `Đạt cột mốc ${milestone.label}!` : "Đạt cột mốc tình yêu!"}
    </h2>
    <p class="mt-2 text-sm text-[color:var(--ink2)]">
      Hai bạn vừa chinh phục thêm một chặng đường đáng nhớ trong hành trình yêu thương.
    </p>

    {#if milestone?.date}
      <div class="mt-4 rounded-2xl border border-white/80 bg-white/70 p-4">
        <p class="text-sm text-[color:var(--ink2)]">Thời điểm đạt cột mốc</p>
        <p class="mt-1 text-base font-bold text-[color:var(--ink)]">{formatDateTime(milestone.date)}</p>
      </div>
    {/if}

    <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2 text-sm text-[color:var(--ink2)]">
        <span class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-pink-200/80 bg-pink-50 text-lg">
          🦩🏆
        </span>
        <span>{queueCount > 0 ? `Còn ${queueCount} cột mốc đang chờ chúc mừng` : "Tiếp tục giữ lửa yêu thương nhé"}</span>
      </div>
    </div>
  </div>
</ModalShell>
