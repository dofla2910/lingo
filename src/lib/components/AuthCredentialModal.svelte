<script>
  import { createEventDispatcher } from "svelte";
  import ModalShell from "./ModalShell.svelte";

  export let open = false;
  export let busy = false;
  export let mode = "signin";
  export let username = "";
  export let password = "";
  export let passwordConfirm = "";
  export let pendingAutoPairAfterAuth = false;
  export let errorText = "";
  export let infoText = "";

  const dispatch = createEventDispatcher();

  function closeModal() {
    if (busy) return;
    dispatch("close");
  }

  function submitForm() {
    dispatch("submit");
  }

  function setMode(nextMode) {
    if (busy) return;
    dispatch("modechange", nextMode === "signup" ? "signup" : "signin");
  }

  function toggleMode() {
    if (busy) return;
    dispatch("togglemode");
  }

  function handleUsernameInput(event) {
    dispatch("usernameinput", event.currentTarget.value);
  }

  function handlePasswordInput(event) {
    dispatch("passwordinput", event.currentTarget.value);
  }

  function handlePasswordConfirmInput(event) {
    dispatch("passwordconfirminput", event.currentTarget.value);
  }
</script>

<ModalShell
  open={open}
  close={closeModal}
  labelledBy="credentialAuthTitle"
  preset="modal-preset-form"
  cardStyle="max-width: 34rem;"
>
  <div slot="header" class="flex items-center justify-between">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Tài khoản</p>
      <h3 id="credentialAuthTitle" class="text-lg font-bold text-[color:var(--ink)]">
        {mode === "signup" ? "Tạo tài khoản" : "Đăng nhập"}
      </h3>
    </div>
    <!-- <button type="button" class="btn btn-soft text-sm" on:click={closeModal} disabled={busy}>Đóng</button> -->
  </div>

  <form class="space-y-3" on:submit|preventDefault={submitForm}>
    <div class="rounded-2xl border border-white/70 bg-white/70 p-4">
      <div class="flex items-center gap-2 text-xs">
        <button
          type="button"
          class={`pill ${mode === "signin" ? "!bg-pink-100 !text-pink-700" : ""}`}
          on:click={() => setMode("signin")}
          disabled={busy}
        >
          Đăng nhập
        </button>
        <button
          type="button"
          class={`pill ${mode === "signup" ? "!bg-pink-100 !text-pink-700" : ""}`}
          on:click={() => setMode("signup")}
          disabled={busy}
        >
          Tạo tài khoản
        </button>
        {#if pendingAutoPairAfterAuth}
          <span class="pill">Tự tạo mã sau đăng nhập</span>
        {/if}
      </div>

      <p class="mt-2 text-sm text-[color:var(--ink2)]">
        {#if mode === "signup"}
          Tạo tài khoản bằng tên đăng nhập và mật khẩu để dùng chung phòng cặp đôi.
        {:else}
          Nhập tên đăng nhập và mật khẩu để tiếp tục ghép cặp.
        {/if}
      </p>

      <div class="mt-3">
        <label class="label" for="cred_username">Tên đăng nhập</label>
        <input
          id="cred_username"
          class="field mt-1 text-sm"
          type="text"
          placeholder="ví dụ: hieu_duong"
          autocomplete="username"
          maxlength="32"
          value={username}
          on:input={handleUsernameInput}
          disabled={busy}
        />
        <p class="mt-1 text-xs text-[color:var(--ink2)]">Chỉ dùng chữ thường, số, dấu chấm, gạch dưới hoặc gạch ngang.</p>
      </div>

      <div class="mt-3">
        <label class="label" for="cred_password">Mật khẩu</label>
        <input
          id="cred_password"
          class="field mt-1 text-sm"
          type="password"
          placeholder="Ít nhất 6 ký tự"
          autocomplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          on:input={handlePasswordInput}
          disabled={busy}
        />
      </div>

      {#if mode === "signup"}
        <div class="mt-3">
          <label class="label" for="cred_password_confirm">Nhập lại mật khẩu</label>
          <input
            id="cred_password_confirm"
            class="field mt-1 text-sm"
            type="password"
            placeholder="Nhập lại mật khẩu"
            autocomplete="new-password"
            value={passwordConfirm}
            on:input={handlePasswordConfirmInput}
            disabled={busy}
          />
        </div>
      {/if}

      <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button class="btn btn-primary text-sm w-full" type="submit" disabled={busy}>
          {#if busy}
            {mode === "signup" ? "Đang tạo tài khoản..." : "Đang đăng nhập..."}
          {:else}
            {mode === "signup" ? "Tạo tài khoản" : "Đăng nhập"}
          {/if}
        </button>
        <button class="btn btn-soft text-sm w-full" type="button" on:click={toggleMode} disabled={busy}>
          {mode === "signup" ? "Đã có tài khoản" : "Tạo tài khoản mới"}
        </button>
      </div>
    </div>

    {#if errorText}
      <p class="rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{errorText}</p>
    {/if}
    {#if infoText}
      <p class="rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-2 text-sm text-sky-700">{infoText}</p>
    {/if}
  </form>
</ModalShell>
