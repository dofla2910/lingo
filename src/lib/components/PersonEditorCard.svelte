<script>
  import { createEventDispatcher } from "svelte";
  import { fallbackFlamingoAvatar, GENDER_LABELS } from "../lingo/utils.js";

  export let title = "Người";
  export let draft;
  export let idPrefix = "person";

  const dispatch = createEventDispatcher();
  const fallbackAvatar = fallbackFlamingoAvatar(160);

  $: previewSrc = draft?.useDefault
    ? fallbackAvatar
    : (draft?.uploadedAvatarData || draft?.avatarUrlInput?.trim() || draft?.existingAvatarUrl || fallbackAvatar);

  function onImageError(event) {
    event.currentTarget.src = fallbackAvatar;
  }

  function onFileChange(event) {
    const file = event.currentTarget.files?.[0] || null;
    dispatch("avatar-file", { file });
  }
</script>

<section class="rounded-2xl border border-white/70 bg-white/70 p-4">
  <div class="flex items-start gap-3">
    <div class="avatar-wrap h-[74px] w-[74px] shrink-0">
      <img
        src={previewSrc}
        alt={`Avatar ${title}`}
        class="h-full w-full rounded-[14px] object-cover bg-white"
        on:error={onImageError}
      />
    </div>
    <div class="min-w-0 flex-1">
      <h3 class="text-base font-bold text-[color:var(--ink)]">{title}</h3>
      <p class="text-xs text-[color:var(--ink2)]">Tên, ngày sinh, giới tính và avatar hồng hạc.</p>
    </div>
  </div>

  <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
    <div class="sm:col-span-2">
      <label class="label" for={`${idPrefix}_name`}>Tên</label>
      <input id={`${idPrefix}_name`} class="field mt-1 text-sm" type="text" maxlength="40" bind:value={draft.name} />
    </div>

    <div>
      <label class="label" for={`${idPrefix}_birthday`}>Ngày sinh</label>
      <input id={`${idPrefix}_birthday`} class="field mt-1 text-sm" type="date" bind:value={draft.birthday} />
    </div>

    <div>
      <label class="label" for={`${idPrefix}_gender`}>Giới tính</label>
      <select id={`${idPrefix}_gender`} class="field mt-1 text-sm" bind:value={draft.gender}>
        <option value="nam">{GENDER_LABELS.nam}</option>
        <option value="nu">{GENDER_LABELS.nu}</option>
        <option value="khac">{GENDER_LABELS.khac}</option>
        <option value="khong_tiet_lo">{GENDER_LABELS.khong_tiet_lo}</option>
      </select>
    </div>

    <div class="sm:col-span-2">
      <label class="label" for={`${idPrefix}_avatar_url`}>Avatar URL (tuỳ chọn)</label>
      <input
        id={`${idPrefix}_avatar_url`}
        class="field mt-1 text-sm"
        type="url"
        placeholder="https://..."
        bind:value={draft.avatarUrlInput}
        on:input={() => {
          if (draft.avatarUrlInput?.trim()) draft.useDefault = false;
        }}
      />
    </div>

    <div class="sm:col-span-2">
      <label class="label" for={`${idPrefix}_avatar_file`}>Tải ảnh lên (tuỳ chọn)</label>
      <input id={`${idPrefix}_avatar_file`} class="field mt-1 text-sm" type="file" accept="image/*" on:change={onFileChange} />
      {#if draft.uploadedAvatarData}
        <p class="mt-1 text-xs text-pink-600">Đã chọn ảnh mới (sẽ lưu khi bấm Lưu/Hoàn tất).</p>
      {/if}
    </div>
  </div>

  <label class="mt-3 flex items-center gap-2 text-sm text-[color:var(--ink)]">
    <input class="h-4 w-4 rounded" type="checkbox" bind:checked={draft.useDefault} />
    <span>Dùng avatar hồng hạc mặc định</span>
  </label>
</section>

