<script>
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import { sanitizeRoomCode, supabase } from "$lib/lingo/supabaseClient.js";
  import TimeCapsuleCard from "./TimeCapsuleCard.svelte";
  import TimeCapsuleCreateModal from "./TimeCapsuleCreateModal.svelte";
  import TimeCapsuleReaderModal from "./TimeCapsuleReaderModal.svelte";
  import {
    MIN_UNLOCK_AHEAD_MS,
    guessExtFromMime,
    isUnlocked,
    parseDateTimeSafe,
    sortCapsules,
    toLocalDateTimeInputValue,
  } from "$lib/lingo/timeCapsuleUtils.js";

  const dispatch = createEventDispatcher();
  const BUCKET_NAME = "lingo-gallery";
  const FILE_PREFIX = "time-capsules";

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

  function openReader(event) {
    activeCapsule = event?.detail || null;
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
      <button class="btn btn-soft mt-2 text-xs min-h-[34px]" type="button" on:click={retryFetch} disabled={loading}>
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
          <TimeCapsuleCard {item} {now} on:open={openReader} />
        {/each}
      </div>
    {/if}
  </div>
</section>

<TimeCapsuleReaderModal open={readerOpen} capsule={activeCapsuleLive} {now} on:close={closeReader} />

<TimeCapsuleCreateModal
  open={formOpen}
  {saving}
  bind:title
  bind:message
  bind:unlockAtLocal
  {minUnlockAtLocal}
  {previewUrl}
  bind:fileInputRef
  on:close={closeCreateForm}
  on:submit={submitCapsule}
  on:filechange={(event) => onFileChange(event.detail)}
/>
