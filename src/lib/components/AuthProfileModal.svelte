<script>
  import { createEventDispatcher } from "svelte";
  import ModalShell from "./ModalShell.svelte";

  export let open = false;
  export let busy = false;
  export let draft = {
    name: "",
    birthday: "",
    gender: "khong_tiet_lo",
    avatarUrlInput: "",
  };
  export let avatarPreview = "";
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

  function updateDraft(field, value) {
    dispatch("draftchange", { field, value });
  }

  function useDefaultAvatar() {
    dispatch("usedefaultavatar");
  }

  function handleAvatarFileChange(event) {
    dispatch("avatarfilechange", event.currentTarget.files?.[0] || null);
  }

  function handleAvatarError(event) {
    dispatch("avatarerror", event);
  }
</script>

<ModalShell
  open={open}
  close={closeModal}
  labelledBy="profileModalTitle"
  preset="modal-preset-form"
  cardStyle="max-width: 38rem;"
>
  <div slot="header" class="flex items-center justify-between">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Hồ sơ cá nhân</p>
      <h3 id="profileModalTitle" class="text-lg font-bold text-[color:var(--ink)]">Thông tin đăng ký</h3>
    </div>
    <!-- <button type="button" class="btn btn-soft text-sm" on:click={closeModal} disabled={busy}>Đóng</button> -->
  </div>

  <form class="space-y-3" on:submit|preventDefault={submitForm}>
    <div class="rounded-2xl border border-white/70 bg-white/70 p-4">
      <div class="flex items-start gap-3">
        <img
          src={avatarPreview}
          alt="Avatar cá nhân"
          class="h-20 w-20 rounded-2xl object-cover border border-pink-200/70 bg-white"
          on:error={handleAvatarError}
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-[color:var(--ink)]">Thông tin này sẽ được dùng khi bạn đăng nhập</p>
          <p class="mt-1 text-xs text-[color:var(--ink2)]">Tên, ngày sinh, giới tính và avatar sẽ tự hiện trong hồ sơ cặp đôi.</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button class="btn btn-soft text-sm" type="button" on:click={useDefaultAvatar} disabled={busy}>
              Dùng avatar mặc định
            </button>
          </div>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="label" for="reg_name">Tên hiển thị</label>
          <input
            id="reg_name"
            class="field mt-1 text-sm"
            type="text"
            maxlength="60"
            value={draft.name}
            on:input={(event) => updateDraft("name", event.currentTarget.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label class="label" for="reg_birthday">Ngày sinh</label>
          <input
            id="reg_birthday"
            class="field mt-1 text-sm"
            type="date"
            value={draft.birthday}
            on:input={(event) => updateDraft("birthday", event.currentTarget.value)}
            disabled={busy}
          />
        </div>

        <div>
          <label class="label" for="reg_gender">Giới tính</label>
          <select
            id="reg_gender"
            class="field mt-1 text-sm"
            value={draft.gender}
            on:change={(event) => updateDraft("gender", event.currentTarget.value)}
            disabled={busy}
          >
            <option value="nam">Nam</option>
            <option value="nu">Nữ</option>
            <option value="khac">Khác</option>
            <option value="khong_tiet_lo">Không tiết lộ</option>
          </select>
        </div>

        <div class="sm:col-span-2">
          <label class="label" for="reg_avatar_url">Avatar URL (tuỳ chọn)</label>
          <input
            id="reg_avatar_url"
            class="field mt-1 text-sm"
            type="url"
            placeholder="https://..."
            value={draft.avatarUrlInput}
            on:input={(event) => updateDraft("avatarUrlInput", event.currentTarget.value)}
            disabled={busy}
          />
        </div>

        <div class="sm:col-span-2">
          <label class="label" for="reg_avatar_upload">Tải ảnh lên (tuỳ chọn)</label>
          <input
            id="reg_avatar_upload"
            class="field mt-1 text-sm"
            type="file"
            accept="image/*"
            disabled={busy}
            on:change={handleAvatarFileChange}
          />
        </div>
      </div>
    </div>

    {#if errorText}
      <p class="rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{errorText}</p>
    {/if}
    {#if infoText}
      <p class="rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-2 text-sm text-sky-700">{infoText}</p>
    {/if}

    <div class="flex justify-end gap-2">
      <button class="btn btn-soft text-sm" type="button" on:click={closeModal} disabled={busy}>Để sau</button>
      <button class="btn btn-primary text-sm" type="submit" disabled={busy}>
        {busy ? "Đang lưu..." : "Lưu hồ sơ"}
      </button>
    </div>
  </form>
</ModalShell>
