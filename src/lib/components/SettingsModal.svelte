<script>
  import { createEventDispatcher } from "svelte";
  import ModalShell from "./ModalShell.svelte";

  export let open = false;
  export let state;
  export let actions;
  export let toast = (msg) => console.log(msg);

  const dispatch = createEventDispatcher();

  let systemFont = "be_vietnam_pro";
  let errorText = "";
  let busy = false;
  let lastHydratedSignature = "";

  const FONT_OPTIONS = [
    {
      id: "be_vietnam_pro",
      label: "Be Vietnam Pro",
      desc: "Gọn gàng, hiện đại, dễ đọc.",
      cardStyle: "font-family:'Be Vietnam Pro',sans-serif;",
      previewTitle: "Lingo - Bộ đếm ngày yêu",
      previewBody: "Tình yêu bền vững theo thời gian.",
      titleStyle: "font-family:'Be Vietnam Pro',sans-serif;",
      bodyStyle: "font-family:'Be Vietnam Pro',sans-serif;",
    },
    {
      id: "paytone_one",
      label: "Paytone One",
      desc: "Đậm, hiện đại, nổi bật tiêu đề.",
      cardStyle: "font-family:'Paytone One',sans-serif;",
      previewTitle: "Lingo",
      previewBody: "Tình yêu của hai bạn, rõ ràng và cá tính.",
      titleStyle: "font-family:'Paytone One',sans-serif;",
      bodyStyle: "font-family:'Paytone One',sans-serif;",
    },
    {
      id: "itim",
      label: "Itim",
      desc: "Dễ thương, mềm mại, thân thiện.",
      cardStyle: "font-family:'Itim',cursive;",
      previewTitle: "Lingo",
      previewBody: "Ngôn ngữ tình yêu riêng của hai bạn.",
      titleStyle: "font-family:'Itim',cursive;",
      bodyStyle: "font-family:'Itim',cursive;",
    },
    {
      id: "pangolin",
      label: "Pangolin",
      desc: "Nét tròn vui tươi, dễ nhìn.",
      cardStyle: "font-family:'Pangolin',cursive;",
      previewTitle: "Lingo",
      previewBody: "Mỗi khoảnh khắc yêu đều đáng nhớ.",
      titleStyle: "font-family:'Pangolin',cursive;",
      bodyStyle: "font-family:'Pangolin',cursive;",
    },
    {
      id: "pacifico",
      label: "Pacifico",
      desc: "Chữ viết tay mềm mại, cảm xúc.",
      cardStyle: "font-family:'Pacifico',cursive;",
      previewTitle: "Lingo",
      previewBody: "Ngôn ngữ tình yêu riêng của hai bạn.",
      titleStyle: "font-family:'Pacifico',cursive;",
      bodyStyle: "font-family:'Pacifico',cursive;",
    },
    {
      id: "prata",
      label: "Prata",
      desc: "Thanh lịch kiểu serif, dễ đọc.",
      cardStyle: "font-family:'Prata',serif;",
      previewTitle: "Lingo",
      previewBody: "Ngôn ngữ tình yêu riêng của hai bạn.",
      titleStyle: "font-family:'Prata',serif;",
      bodyStyle: "font-family:'Prata',serif;",
    },
  ];

  function normalizeFont(value) {
    if (value === "paytone_one") return "paytone_one";
    if (value === "itim") return "itim";
    if (value === "pangolin") return "pangolin";
    if (value === "pacifico") return "pacifico";
    if (value === "prata" || value === "pacifico_prata") return "prata";
    return "be_vietnam_pro";
  }

  function hydrateFromState() {
    systemFont = normalizeFont(state?.ui?.systemFont);
    errorText = "";
  }

  function signatureForState() {
    const s = state || {};
    return JSON.stringify({
      systemFont: normalizeFont(s?.ui?.systemFont),
    });
  }

  $: if (open) {
    const sig = signatureForState();
    if (sig !== lastHydratedSignature) {
      hydrateFromState();
      lastHydratedSignature = sig;
    }
  }

  function requestClose() {
    if (busy) return;
    dispatch("close");
  }

  function handleKeydown(event) {
    if (!open) return;
    if (event.key === "Escape") requestClose();
  }

  async function save() {
    errorText = "";
    busy = true;
    try {
      await actions.setSystemFont(systemFont);
      toast("Đã lưu cài đặt font hệ thống.");
      dispatch("saved");
      dispatch("close");
    } catch (err) {
      errorText = err?.message || "Không thể lưu cài đặt font.";
    } finally {
      busy = false;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<ModalShell
  open={open}
  close={requestClose}
  labelledBy="settingsTitle"
  preset="modal-preset-form"
  maxWidth="max-w-3xl"
  showCancelAction={true}
  showPrimaryAction={true}
  cancelLabel="Huỷ"
  primaryLabel={busy ? "Đang lưu..." : "Lưu thay đổi"}
  cancelDisabled={busy}
  primaryDisabled={busy}
  onPrimaryAction={save}
>
  <div slot="header" class="flex items-center justify-between">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Cài đặt</p>
      <h2 id="settingsTitle" class="text-lg font-bold text-[color:var(--ink)]">Cài đặt font hệ thống</h2>
    </div>
    <!-- <button type="button" class="btn btn-soft text-sm" on:click={requestClose}>Đóng</button> -->
  </div>

  <div>
    <p class="text-sm text-[color:var(--ink2)]">Chọn kiểu chữ dùng cho toàn bộ giao diện.</p>

    <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each FONT_OPTIONS as option}
        <label
          class={`flex cursor-pointer flex-col gap-2 rounded-2xl border p-3 transition ${
            systemFont === option.id
              ? "border-pink-300 bg-pink-50/80 shadow-sm shadow-pink-100"
              : "border-pink-100/70 bg-white/70 hover:border-pink-200"
          }`}
          style={option.cardStyle}
        >
          <span class="flex items-start gap-3">
            <input
              class="mt-1 h-4 w-4 accent-pink-500"
              type="radio"
              name="system_font"
              value={option.id}
              bind:group={systemFont}
            />
            <span>
              <span class="block text-sm font-semibold text-[color:var(--ink)]">{option.label}</span>
              <span class="block text-xs text-[color:var(--ink2)]">{option.desc}</span>
            </span>
          </span>

          <div class="rounded-xl border border-white/80 bg-white/80 px-3 py-2">
            <p class="text-base leading-tight text-[color:var(--ink)]" style={option.titleStyle}>{option.previewTitle}</p>
            <p class="mt-1 text-xs text-[color:var(--ink2)]" style={option.bodyStyle}>{option.previewBody}</p>
          </div>
        </label>
      {/each}
    </div>

    {#if errorText}
      <p class="mt-4 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">
        {errorText}
      </p>
    {/if}
  </div>

</ModalShell>
