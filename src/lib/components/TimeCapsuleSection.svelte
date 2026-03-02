<script>
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { sanitizeRoomCode, supabase } from "$lib/lingo/supabaseClient.js";

  const dispatch = createEventDispatcher();
  const BUCKET_NAME = "lingo-gallery";
  const FILE_PREFIX = "time-capsules";
  const MIN_UNLOCK_AHEAD_MS = 1000;

  export let roomId = "";

  let now = Date.now();
  let tickTimer = 0;
  let roomSyncToken = 0;
  let initialized = false;
  let roomCode = "";
  let roomUuid = "";

  let capsules = [];
  let loading = false;
  let saving = false;
  let errorText = "";

  let formOpen = false;
  let readerOpen = false;
  let activeCapsule = null;

  let title = "";
  let message = "";
  let unlockAtLocal = "";
  let minUnlockAtLocal = "";
  let selectedFile = null;
  let previewUrl = "";
  let fileInputRef;

  $: normalizedRoomCode = sanitizeRoomCode(roomId);
  $: sortedCapsules = sortCapsules(capsules);
  $: lockedCount = sortedCapsules.filter((item) => !isUnlocked(item, now)).length;
  $: unlockedCount = sortedCapsules.length - lockedCount;
  $: activeCapsuleLive = activeCapsule
    ? sortedCapsules.find((item) => item.id === activeCapsule.id) || activeCapsule
    : null;
  $: activeLocked = activeCapsuleLive ? !isUnlocked(activeCapsuleLive, now) : false;

  function parseError(err, fallback = "Có lỗi xảy ra.") {
    const msg = String(err?.message || "").trim();
    if (!msg) return fallback;
    const lower = msg.toLowerCase();
    if (lower.includes("permission")) return "Bạn chưa có quyền truy cập Hộp thư thời gian.";
    if (lower.includes("auth")) return "Vui lòng đăng nhập để sử dụng tính năng này.";
    if (lower.includes("bucket")) return "Không thể truy cập kho ảnh time capsule.";
    if (lower.includes("room_not_found")) return "Không tìm thấy phòng dữ liệu hiện tại.";
    return fallback;
  }

  function parseDateTimeSafe(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function toLocalDateTimeInputValue(value) {
    const date = parseDateTimeSafe(value) || new Date(Date.now() + 24 * 60 * 60 * 1000);
    const localMs = date.getTime() - date.getTimezoneOffset() * 60 * 1000;
    return new Date(localMs).toISOString().slice(0, 16);
  }

  function formatDateTime(value) {
    const date = parseDateTimeSafe(value);
    if (!date) return "Không hợp lệ";
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function pad2(value) {
    return String(Math.max(0, Number(value) || 0)).padStart(2, "0");
  }

  function remainingMs(unlockAt, currentNow = now) {
    const date = parseDateTimeSafe(unlockAt);
    if (!date) return 0;
    return Math.max(0, date.getTime() - currentNow);
  }

  function countdownParts(unlockAt, currentNow = now) {
    const ms = remainingMs(unlockAt, currentNow);
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds, expired: totalSeconds <= 0 };
  }

  function countdownLabel(unlockAt, currentNow = now) {
    const part = countdownParts(unlockAt, currentNow);
    if (part.expired) return "Đã đến giờ mở";
    return `${pad2(part.days)} : ${pad2(part.hours)} : ${pad2(part.minutes)} : ${pad2(part.seconds)}`;
  }

  function isUnlocked(item, currentNow = now) {
    const date = parseDateTimeSafe(item?.unlock_at);
    if (!date) return false;
    return currentNow >= date.getTime();
  }

  function sortCapsules(list) {
    return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
      const aUnlock = parseDateTimeSafe(a.unlock_at)?.getTime() || 0;
      const bUnlock = parseDateTimeSafe(b.unlock_at)?.getTime() || 0;
      if (aUnlock !== bUnlock) return aUnlock - bUnlock;
      const aCreated = parseDateTimeSafe(a.created_at)?.getTime() || 0;
      const bCreated = parseDateTimeSafe(b.created_at)?.getTime() || 0;
      return bCreated - aCreated;
    });
  }

  function clearPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = "";
    selectedFile = null;
    if (fileInputRef) fileInputRef.value = "";
  }

  function setSelectedFile(file) {
    clearPreview();
    selectedFile = file;
    previewUrl = URL.createObjectURL(file);
  }

  function onFileChange(event) {
    const file = event.currentTarget?.files?.[0];
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      errorText = "Vui lòng chọn file ảnh hợp lệ.";
      clearPreview();
      return;
    }
    errorText = "";
    setSelectedFile(file);
  }

  function guessExtFromMime(type) {
    const mime = String(type || "").toLowerCase();
    if (mime.includes("png")) return "png";
    if (mime.includes("webp")) return "webp";
    return "jpg";
  }

  async function compressImage(file, { maxWidth = 1600, maxHeight = 1600, quality = 0.82 } = {}) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Không thể đọc ảnh."));
        img.src = objectUrl;
      });

      const srcWidth = Math.max(1, image.width || 1);
      const srcHeight = Math.max(1, image.height || 1);
      const ratio = Math.min(1, maxWidth / srcWidth, maxHeight / srcHeight);
      const targetWidth = Math.max(1, Math.round(srcWidth * ratio));
      const targetHeight = Math.max(1, Math.round(srcHeight * ratio));

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return file;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((value) => {
          if (!value) {
            reject(new Error("Không thể nén ảnh."));
            return;
          }
          resolve(value);
        }, "image/jpeg", quality);
      });

      return new File([blob], `capsule-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function uploadImageIfNeeded() {
    if (!selectedFile) return null;
    const compressed = await compressImage(selectedFile);
    const ext = guessExtFromMime(compressed.type);
    const path = `${FILE_PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from(BUCKET_NAME).upload(path, compressed, {
      cacheControl: "3600",
      upsert: false,
      contentType: compressed.type,
    });
    if (uploadErr) throw uploadErr;

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
    const publicUrl = String(data?.publicUrl || "").trim();
    if (!publicUrl) throw new Error("Không thể lấy URL ảnh.");
    return publicUrl;
  }

  async function resolveRoomUuidByCode(code) {
    const cleanCode = sanitizeRoomCode(code);
    if (!cleanCode) return "";
    const { data, error } = await supabase
      .from("lingo_rooms")
      .select("id")
      .eq("code", cleanCode)
      .maybeSingle();
    if (error) throw error;
    const uuid = String(data?.id || "").trim();
    if (!uuid) throw new Error("ROOM_NOT_FOUND");
    return uuid;
  }

  async function fetchCapsulesByRoomUuid(targetRoomUuid) {
    if (!targetRoomUuid) {
      capsules = [];
      return;
    }
    const { data, error } = await supabase
      .from("time_capsules")
      .select("id,title,message,image_url,unlock_at,created_at,created_by,room_id")
      .eq("room_id", targetRoomUuid)
      .order("unlock_at", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    capsules = Array.isArray(data) ? data : [];
  }

  async function syncRoomAndFetchCapsules(nextRoomCode) {
    const cleanCode = sanitizeRoomCode(nextRoomCode);
    roomCode = cleanCode;
    roomUuid = "";
    capsules = [];

    if (!supabase) {
      errorText = "Supabase chưa cấu hình sẵn sàng.";
      loading = false;
      return;
    }

    if (!cleanCode) {
      errorText = "Hãy ghép cặp để sử dụng Hộp thư thời gian.";
      loading = false;
      return;
    }

    const token = ++roomSyncToken;
    loading = true;
    errorText = "";

    try {
      const resolvedRoomUuid = await resolveRoomUuidByCode(cleanCode);
      if (token !== roomSyncToken) return;
      roomUuid = resolvedRoomUuid;
      await fetchCapsulesByRoomUuid(resolvedRoomUuid);
    } catch (err) {
      if (token !== roomSyncToken) return;
      errorText = parseError(err, "Không thể tải Time Capsule.");
      capsules = [];
    } finally {
      if (token === roomSyncToken) loading = false;
    }
  }

  function resetForm() {
    title = "";
    message = "";
    unlockAtLocal = toLocalDateTimeInputValue();
    minUnlockAtLocal = toLocalDateTimeInputValue(Date.now() + MIN_UNLOCK_AHEAD_MS);
    errorText = "";
    clearPreview();
  }

  function openCreateForm() {
    resetForm();
    formOpen = true;
  }

  function closeCreateForm() {
    if (saving) return;
    formOpen = false;
    resetForm();
  }

  function openReader(item) {
    activeCapsule = item;
    readerOpen = true;
  }

  function closeReader() {
    readerOpen = false;
    activeCapsule = null;
  }

  function retryFetch() {
    if (loading) return;
    syncRoomAndFetchCapsules(roomCode || normalizedRoomCode);
  }

  async function submitCapsule() {
    if (!supabase) {
      errorText = "Supabase chưa cấu hình sẵn sàng.";
      return;
    }
    if (!roomUuid) {
      errorText = "Hãy ghép cặp và vào phòng trước khi tạo Hộp thư thời gian.";
      return;
    }

    const cleanTitle = String(title || "").trim();
    const cleanMessage = String(message || "").trim();
    const unlockDate = parseDateTimeSafe(unlockAtLocal);

    if (!cleanTitle) {
      errorText = "Vui lòng nhập tiêu đề hộp thư.";
      return;
    }
    if (!cleanMessage) {
      errorText = "Vui lòng nhập nội dung lời nhắn.";
      return;
    }
    if (!unlockDate) {
      errorText = "Thời điểm mở không hợp lệ.";
      return;
    }
    if (unlockDate.getTime() <= Date.now() + MIN_UNLOCK_AHEAD_MS) {
      errorText = "Vui lòng chọn thời điểm mở trong tương lai.";
      return;
    }

    saving = true;
    errorText = "";
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const userId = String(authData?.user?.id || "").trim();
      if (!userId) throw new Error("Vui lòng đăng nhập để tạo Time Capsule.");

      const imageUrl = await uploadImageIfNeeded();
      const payload = {
        room_id: roomUuid,
        title: cleanTitle,
        message: cleanMessage,
        image_url: imageUrl,
        unlock_at: unlockDate.toISOString(),
        created_by: userId,
      };

      const { data, error } = await supabase
        .from("time_capsules")
        .insert(payload)
        .select("id,title,message,image_url,unlock_at,created_at,created_by,room_id")
        .single();
      if (error) throw error;

      capsules = sortCapsules([data, ...capsules]);
      formOpen = false;
      resetForm();
      dispatch("toast", "Đã tạo Time Capsule mới.");
    } catch (err) {
      errorText = parseError(err, "Không thể tạo Time Capsule.");
    } finally {
      saving = false;
    }
  }

  function handleWindowKeydown(event) {
    if (event.key !== "Escape") return;
    if (formOpen) closeCreateForm();
    if (readerOpen) closeReader();
  }

  onMount(() => {
    initialized = true;
    syncRoomAndFetchCapsules(normalizedRoomCode);
    tickTimer = window.setInterval(() => {
      now = Date.now();
    }, 1000);
  });

  $: if (initialized && !loading && normalizedRoomCode !== roomCode) {
    syncRoomAndFetchCapsules(normalizedRoomCode);
  }

  onDestroy(() => {
    if (tickTimer) window.clearInterval(tickTimer);
    clearPreview();
  });
</script>

<svelte:window on:keydown={handleWindowKeydown} />

<section class="card rounded-3xl p-4 sm:p-5" aria-labelledby="timeCapsuleTitle">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Time Capsule</p>
      <h2 id="timeCapsuleTitle" class="text-lg sm:text-xl font-bold text-[color:var(--ink)]">Hộp thư thời gian</h2>
      <p class="text-sm text-[color:var(--ink2)]">
        Lưu lại một lá thư và đặt thời điểm mở. Chờ đến đúng khoảnh khắc để đọc.
      </p>
    </div>
    <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
      <span class="pill">{lockedCount} đang khóa</span>
      <span class="pill">{unlockedCount} đã mở</span>
      <button
        class="btn btn-primary text-sm min-h-[44px] w-full sm:w-auto"
        type="button"
        on:click={openCreateForm}
        disabled={!roomUuid || loading}
      >
        + Tạo hộp thư
      </button>
    </div>
  </div>

  {#if errorText}
    <div class="mt-3 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2">
      <p class="text-sm font-medium text-rose-600">{errorText}</p>
      <button
        class="btn btn-soft mt-2 text-xs min-h-[34px]"
        type="button"
        on:click={retryFetch}
        disabled={loading}
      >
        Thử lại
      </button>
    </div>
  {/if}

  <div class="mt-4">
    {#if loading}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {#each Array(4) as _, idx (idx)}
          <div class="rounded-2xl border border-pink-100/80 bg-white/75 p-4">
            <div class="skl h-3 w-24"></div>
            <div class="skl mt-3 h-5 w-4/5"></div>
            <div class="skl mt-3 h-16 w-full"></div>
            <div class="skl mt-3 h-4 w-2/3"></div>
          </div>
        {/each}
      </div>
    {:else if !sortedCapsules.length}
      <div class="rounded-2xl border border-dashed border-pink-200 bg-white/70 px-4 py-6 text-center">
        <p class="text-base font-semibold text-[color:var(--ink)]">Chưa có Time Capsule nào</p>
        <p class="mt-1 text-sm text-[color:var(--ink2)]">Hãy tạo hộp thư đầu tiên để gửi lời nhắn cho tương lai.</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {#each sortedCapsules as item (item.id)}
          <button
            type="button"
            class={`w-full text-left rounded-2xl border p-4 transition ${
              isUnlocked(item, now)
                ? "border-pink-200/90 bg-gradient-to-br from-white to-pink-50/80 shadow-[0_0_0_1px_rgba(255,185,214,0.45),0_14px_30px_rgba(255,140,184,0.18)]"
                : "border-rose-200/80 bg-gradient-to-br from-rose-50/85 via-white to-pink-100/70"
            }`}
            on:click={() => openReader(item)}
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs font-semibold uppercase tracking-[.14em] text-pink-500/80">
                  {isUnlocked(item, now) ? "🔓 Đã mở" : "🔒 Đang khóa"}
                </p>
                <h3 class="mt-1 line-clamp-2 text-base font-bold text-[color:var(--ink)]">{item.title}</h3>
              </div>
              <p class="pill shrink-0 text-[10px]">{formatDateTime(item.unlock_at)}</p>
            </div>

            {#if isUnlocked(item, now)}
              <p class="mt-3 line-clamp-3 text-sm text-[color:var(--ink2)]">{item.message}</p>
            {:else}
              <p class="mt-3 text-sm font-semibold text-pink-600">{countdownLabel(item.unlock_at, now)}</p>
              <p class="mt-1 text-xs text-[color:var(--ink2)]">Định dạng: Ngày : Giờ : Phút : Giây</p>
            {/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</section>

<div class={`modal ${readerOpen ? "open" : ""}`} aria-hidden={!readerOpen} on:click|self={closeReader}>
  <div class="modal-card max-w-3xl" role="dialog" aria-modal="true" aria-labelledby="capsuleReaderTitle" tabindex="-1">
    {#if activeCapsuleLive}
      <div class="flex items-center justify-between border-b border-pink-100/70 px-4 py-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Hộp thư</p>
          <h3 id="capsuleReaderTitle" class="text-lg font-bold text-[color:var(--ink)]">{activeCapsuleLive.title}</h3>
        </div>
        <button class="btn btn-soft text-sm" type="button" on:click={closeReader}>Đóng</button>
      </div>

      <div class="max-h-[76vh] overflow-y-auto px-4 py-4">
        <p class="text-xs text-[color:var(--ink2)]">Mở vào: {formatDateTime(activeCapsuleLive.unlock_at)}</p>

        <div class="relative mt-3 overflow-hidden rounded-2xl border border-pink-100/80 bg-white/85">
          {#if activeCapsuleLive.image_url}
            <img
              src={activeCapsuleLive.image_url}
              alt={activeCapsuleLive.title}
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
                <p class="mt-1 text-lg font-extrabold tracking-wider text-pink-600">{countdownLabel(activeCapsuleLive.unlock_at, now)}</p>
                <p class="mt-1 text-xs text-[color:var(--ink2)]">Ngày : Giờ : Phút : Giây</p>
              </div>
            </div>
          {/if}
        </div>

        <div class="mt-3 rounded-2xl border border-pink-100/80 bg-white/80 p-4">
          {#if activeLocked}
            <div class="relative overflow-hidden rounded-xl border border-white/80 bg-white/70 p-3">
              <div class="blur-md select-none text-[color:var(--ink2)]">
                {activeCapsuleLive.message}
              </div>
              <div class="absolute inset-0 bg-white/20"></div>
            </div>
          {:else}
            <div transition:fade={{ duration: 320 }}>
              <p class="whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--ink)]">{activeCapsuleLive.message}</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<div class={`modal ${formOpen ? "open" : ""}`} aria-hidden={!formOpen} on:click|self={closeCreateForm}>
  <div class="modal-card max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="capsuleCreateTitle" tabindex="-1">
    <div class="flex items-center justify-between border-b border-pink-100/70 px-4 py-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Time Capsule</p>
        <h3 id="capsuleCreateTitle" class="text-lg font-bold text-[color:var(--ink)]">Tạo Hộp thư thời gian</h3>
      </div>
      <button class="btn btn-soft text-sm" type="button" on:click={closeCreateForm} disabled={saving}>Đóng</button>
    </div>

    <form class="space-y-3 px-4 py-4" on:submit|preventDefault={submitCapsule}>
      <div>
        <label class="label" for="capsule_title">Tiêu đề</label>
        <input
          id="capsule_title"
          class="field mt-1 text-sm"
          type="text"
          maxlength="120"
          bind:value={title}
          placeholder="Ví dụ: Lá thư cho kỷ niệm 2 năm"
          disabled={saving}
        />
      </div>

      <div>
        <label class="label" for="capsule_message">Nội dung</label>
        <textarea
          id="capsule_message"
          class="field mt-1 min-h-[120px] text-sm"
          maxlength="2000"
          bind:value={message}
          placeholder="Viết lời nhắn gửi cho tương lai..."
          disabled={saving}
        ></textarea>
      </div>

      <div>
        <label class="label" for="capsule_unlock_at">Thời điểm mở (ngày + giờ chính xác)</label>
        <input
          id="capsule_unlock_at"
          class="field mt-1 text-sm"
          type="datetime-local"
          bind:value={unlockAtLocal}
          min={minUnlockAtLocal}
          disabled={saving}
        />
      </div>

      <div>
        <label class="label" for="capsule_image">Ảnh đính kèm (tuỳ chọn)</label>
        <input
          id="capsule_image"
          bind:this={fileInputRef}
          class="field mt-1 text-sm"
          type="file"
          accept="image/*"
          capture="environment"
          on:change={onFileChange}
          disabled={saving}
        />
      </div>

      {#if previewUrl}
        <div class="overflow-hidden rounded-2xl border border-pink-100/80 bg-white/80 p-2">
          <img src={previewUrl} alt="Xem trước ảnh time capsule" class="max-h-52 w-full object-contain" />
        </div>
      {/if}

      <div class="flex flex-wrap justify-end gap-2 border-t border-pink-100/70 pt-3">
        <button class="btn btn-soft text-sm min-h-[40px]" type="button" on:click={closeCreateForm} disabled={saving}>
          Huỷ
        </button>
        <button class="btn btn-primary text-sm min-h-[40px]" type="submit" disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu Time Capsule"}
        </button>
      </div>
    </form>
  </div>
</div>
