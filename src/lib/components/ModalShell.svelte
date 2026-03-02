<script>
  import { createEventDispatcher } from "svelte";

  const PRESET_TOKENS = {
    "modal-preset-sm": {
      headerClass: "flex items-center justify-between border-b border-pink-100/70 px-4 py-3",
      bodyClass: "modal-body px-4 py-4",
      footerClass: "flex justify-end gap-2 border-t border-pink-100/70 px-4 py-3",
    },
    "modal-preset-form": {
      headerClass: "flex items-center justify-between border-b border-pink-100/70 px-4 py-3 sm:px-5",
      bodyClass: "modal-scroll px-4 py-4 sm:px-5",
      footerClass: "flex justify-end gap-2 border-t border-pink-100/70 px-4 py-3 sm:px-5",
    },
    "modal-preset-gallery": {
      headerClass: "gallery-modal-header border-b border-pink-100/70 px-4 py-3",
      bodyClass: "modal-scroll px-4 py-4",
      footerClass: "flex justify-end gap-2 border-t border-pink-100/70 px-4 py-3",
    },
  };

  export let open = false;
  export let close = () => {};
  export let labelledBy = "";
  export let preset = "modal-preset-form";
  export let maxWidth = "";
  export let cardClass = "";
  export let cardStyle = "";
  export let headerClass = "";
  export let bodyClass = "";
  export let footerClass = "";
  export let closeOnBackdrop = true;
  export let showActions = false;
  export let showCancelAction = undefined;
  export let showPrimaryAction = undefined;
  export let cancelLabel = "Hủy";
  export let primaryLabel = "Lưu";
  export let primaryType = "button";
  export let primaryForm = "";
  export let cancelDisabled = false;
  export let primaryDisabled = false;
  export let cancelClass = "btn btn-soft text-sm";
  export let primaryClass = "btn btn-primary text-sm";
  export let onPrimaryAction = null;
  export let onCancelAction = null;

  const dispatch = createEventDispatcher();

  $: presetClasses = PRESET_TOKENS[preset] || PRESET_TOKENS["modal-preset-form"];
  $: resolvedHeaderClass = headerClass || presetClasses.headerClass;
  $: resolvedBodyClass = bodyClass || presetClasses.bodyClass;
  $: resolvedFooterClass = footerClass || presetClasses.footerClass;
  $: cardClasses = ["modal-card", preset, maxWidth, cardClass].filter(Boolean).join(" ");
  $: cancelExplicit = typeof showCancelAction === "boolean";
  $: primaryExplicit = typeof showPrimaryAction === "boolean";
  $: resolvedShowCancelAction = cancelExplicit ? showCancelAction : showActions;
  $: resolvedShowPrimaryAction = primaryExplicit ? showPrimaryAction : showActions;
  $: hasResolvedActions = resolvedShowCancelAction || resolvedShowPrimaryAction;

  function requestClose() {
    close?.();
  }

  function onBackdropClick() {
    if (!closeOnBackdrop) return;
    requestClose();
  }

  function handleCancelAction(event) {
    if (cancelDisabled) return;
    dispatch("cancelaction", { source: "footer", event });
    if (typeof onCancelAction === "function") {
      onCancelAction(event);
      return;
    }
    requestClose();
  }

  function handlePrimaryAction(event) {
    if (primaryDisabled) return;
    dispatch("primaryaction", { source: "footer", event });
    if (primaryType === "submit") return;
    if (typeof onPrimaryAction === "function") {
      onPrimaryAction(event);
    }
  }
</script>

<div class={`modal ${open ? "open" : ""}`} aria-hidden={!open} on:click|self={onBackdropClick}>
  <div
    class={cardClasses}
    style={cardStyle || undefined}
    role="dialog"
    aria-modal="true"
    aria-labelledby={labelledBy || undefined}
    tabindex="-1"
  >
    {#if $$slots.header}
      <header class={resolvedHeaderClass}>
        <slot name="header" />
      </header>
    {/if}

    <section class={resolvedBodyClass}>
      <slot />
    </section>

    {#if $$slots.footer}
      <footer class={resolvedFooterClass}>
        <slot name="footer" />
      </footer>
    {:else if hasResolvedActions}
      <footer class={resolvedFooterClass}>
        {#if resolvedShowCancelAction}
          <button
            type="button"
            class={cancelClass}
            on:click={handleCancelAction}
            disabled={cancelDisabled}
          >
            {cancelLabel}
          </button>
        {/if}
        {#if resolvedShowPrimaryAction}
          <button
            type={primaryType}
            form={primaryType === "submit" && primaryForm ? primaryForm : undefined}
            class={primaryClass}
            on:click={handlePrimaryAction}
            disabled={primaryDisabled}
          >
            {primaryLabel}
          </button>
        {/if}
      </footer>
    {/if}
  </div>
</div>
