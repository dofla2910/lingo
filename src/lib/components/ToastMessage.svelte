<script>
  export let message = "";
  export let open = false;
</script>

<div class={`toast ${open ? "show" : ""}`} role="status" aria-live="polite" aria-atomic="true">
  <span class="text-sm font-semibold text-[color:var(--ink)]">{message}</span>
</div>

