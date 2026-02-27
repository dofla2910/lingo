<script>
  import { createEventDispatcher, onDestroy, onMount, tick } from "svelte";
  import { getSupabaseClient } from "../lingo/supabaseClient.js";

  const BUCKET_NAME = "lingo-gallery";
  const dispatch = createEventDispatcher();

  let supabase = null;
  let albumModalOpen = false;

  let albums = [];
  let photos = [];
  let activeAlbumId = "";

  let loadingAlbums = false;
  let loadingPhotos = false;
  let errorText = "";

  let createModalOpen = false;
  let createBusy = false;
  let createName = "";
  let createCoverUrl = "";

  let uploadModalOpen = false;
  let uploadBusy = false;
  let uploadError = "";
  let uploadNote = "";
  let uploadAlbumId = "";

  let viewerOpen = false;
  let viewerPhoto = null;
  let viewerIndex = -1;
  let albumLayout = "pinterest";

  let selectedFile = null;
  let previewUrl = "";
  let galleryInputRef;
  let cameraInputRef;
  let cameraVideoRef;
  let cameraStream = null;
  let cameraOpen = false;
  let cameraBusy = false;
  let cameraError = "";
  let cameraFacing = "environment";

  function albumCoverUrl(album) {
    const cover = String(album?.cover_image_url || "").trim();
    return cover || "/logos/lingo-icon.svg?v=20260227";
  }

  function formatDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatDateTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function activeAlbum() {
    return albums.find((a) => a.id === activeAlbumId) || null;
  }

  function parseError(err, fallback = "Có lỗi xảy ra.") {
    const message = String(err?.message || "").trim();
    if (!message) return fallback;
    if (message.toLowerCase().includes("permission")) {
      return "Bạn chưa có quyền truy cập dữ liệu album.";
    }
    if (message.toLowerCase().includes("bucket")) {
      return "Không thể truy cập bucket lingo-gallery.";
    }
    return message;
  }

  async function initGallery() {
    try {
      supabase = getSupabaseClient();
      await loadAlbums();
    } catch (err) {
      errorText = parseError(err, "Không thể khởi tạo Gallery.");
    }
  }

  async function loadAlbums({ keepCurrentSelection = true } = {}) {
    if (!supabase) return;
    loadingAlbums = true;
    errorText = "";
    try {
      const { data, error } = await supabase
        .from("albums")
        .select("id,name,cover_image_url,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      albums = Array.isArray(data) ? data : [];

      if (!albums.length) {
        activeAlbumId = "";
        photos = [];
        albumModalOpen = false;
        return;
      }

      const hasCurrent = keepCurrentSelection && albums.some((a) => a.id === activeAlbumId);
      if (!hasCurrent) {
        activeAlbumId = albums[0].id;
      }

      if (albumModalOpen && activeAlbumId) {
        await loadPhotos(activeAlbumId);
      }
    } catch (err) {
      errorText = parseError(err, "Không thể tải danh sách album.");
    } finally {
      loadingAlbums = false;
    }
  }

  async function loadPhotos(albumId = activeAlbumId) {
    if (!supabase || !albumId) {
      photos = [];
      return;
    }
    loadingPhotos = true;
    errorText = "";
    try {
      const { data, error } = await supabase
        .from("photos")
        .select("id,album_id,image_url,note,created_at")
        .eq("album_id", albumId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      photos = Array.isArray(data) ? data : [];
    } catch (err) {
      errorText = parseError(err, "Không thể tải ảnh của album.");
    } finally {
      loadingPhotos = false;
    }
  }

  function openAlbum(albumId) {
    activeAlbumId = albumId;
    albumModalOpen = true;
    loadPhotos(albumId);
  }

  function closeAlbumModal() {
    albumModalOpen = false;
  }

  function openPhotoViewer(photo, index) {
    if (!photo) return;
    viewerPhoto = photo;
    viewerIndex = Number(index);
    viewerOpen = true;
  }

  function closePhotoViewer() {
    viewerOpen = false;
    viewerPhoto = null;
    viewerIndex = -1;
  }

  function showPhotoAt(index) {
    const nextIndex = Number(index);
    if (!Number.isFinite(nextIndex)) return;
    if (nextIndex < 0 || nextIndex >= photos.length) return;
    viewerIndex = nextIndex;
    viewerPhoto = photos[nextIndex];
  }

  function showPrevPhoto() {
    if (!photos.length) return;
    const nextIndex = viewerIndex <= 0 ? photos.length - 1 : viewerIndex - 1;
    showPhotoAt(nextIndex);
  }

  function showNextPhoto() {
    if (!photos.length) return;
    const nextIndex = viewerIndex >= photos.length - 1 ? 0 : viewerIndex + 1;
    showPhotoAt(nextIndex);
  }

  function openCreateAlbumModal() {
    createModalOpen = true;
    createName = "";
    createCoverUrl = "";
  }

  function closeCreateAlbumModal() {
    if (createBusy) return;
    createModalOpen = false;
  }

  async function createAlbum() {
    const name = String(createName || "").trim();
    const cover = String(createCoverUrl || "").trim();

    if (!name) {
      dispatch("toast", "Vui lòng nhập tên album.");
      return;
    }

    createBusy = true;
    try {
      const { data, error } = await supabase
        .from("albums")
        .insert({
          name,
          cover_image_url: cover || null,
        })
        .select("id,name,cover_image_url,created_at")
        .single();
      if (error) throw error;

      const album = data || null;
      if (album) {
        albums = [album, ...albums];
        activeAlbumId = album.id;
      }

      createModalOpen = false;
      dispatch("toast", "Đã tạo album mới.");
      if (activeAlbumId) {
        albumModalOpen = true;
        await loadPhotos(activeAlbumId);
      }
    } catch (err) {
      dispatch("toast", parseError(err, "Không thể tạo album."));
    } finally {
      createBusy = false;
    }
  }

  function setSelectedFile(file) {
    selectedFile = file;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    previewUrl = URL.createObjectURL(file);
  }

  function clearPreview() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    previewUrl = "";
    selectedFile = null;
    if (galleryInputRef) galleryInputRef.value = "";
    if (cameraInputRef) cameraInputRef.value = "";
  }

  function stopCameraStream() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }
    if (cameraVideoRef) {
      cameraVideoRef.srcObject = null;
    }
    cameraOpen = false;
    cameraBusy = false;
  }

  async function startCameraStream(nextFacing = cameraFacing) {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Thiết bị/trình duyệt không hỗ trợ mở camera trực tiếp.");
    }

    stopCameraStream();
    cameraBusy = true;
    cameraError = "";

    try {
      const constraintsList = [
        {
          video: {
            facingMode: { exact: nextFacing },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        },
        {
          video: {
            facingMode: { ideal: nextFacing },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        },
        {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        },
      ];

      let stream = null;
      let lastError = null;
      for (const constraints of constraintsList) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          lastError = err;
        }
      }

      if (!stream) {
        throw lastError || new Error("Không thể truy cập camera.");
      }

      cameraStream = stream;
      cameraFacing = nextFacing;
      cameraOpen = true;
      await tick();

      if (cameraVideoRef) {
        cameraVideoRef.srcObject = stream;
        await cameraVideoRef.play().catch(() => {});
      }
    } finally {
      cameraBusy = false;
    }
  }

  async function toggleCameraFacing() {
    if (cameraBusy) return;
    const nextFacing = cameraFacing === "environment" ? "user" : "environment";
    try {
      await startCameraStream(nextFacing);
    } catch (err) {
      cameraError = parseError(err, "Không thể đổi camera trước/sau.");
    }
  }

  async function captureCameraFrame() {
    if (!cameraVideoRef) return;
    const width = Math.max(1, Number(cameraVideoRef.videoWidth || 1280));
    const height = Math.max(1, Number(cameraVideoRef.videoHeight || 720));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      throw new Error("Không thể chụp ảnh từ camera.");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(cameraVideoRef, 0, 0, width, height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => {
        if (!value) {
          reject(new Error("Không thể tạo ảnh chụp."));
          return;
        }
        resolve(value);
      }, "image/jpeg", 0.9);
    });

    const captureFile = new File([blob], `camera-${Date.now()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    uploadError = "";
    setSelectedFile(captureFile);
    stopCameraStream();
  }

  function openUploadModal() {
    if (!albums.length) {
      dispatch("toast", "Hãy tạo album trước khi thêm ảnh.");
      return;
    }
    uploadModalOpen = true;
    uploadBusy = false;
    uploadError = "";
    cameraError = "";
    cameraFacing = "environment";
    uploadNote = "";
    uploadAlbumId = activeAlbumId || albums[0].id;
    stopCameraStream();
    clearPreview();
  }

  function closeUploadModal() {
    if (uploadBusy) return;
    uploadModalOpen = false;
    uploadError = "";
    cameraError = "";
    stopCameraStream();
    clearPreview();
  }

  function handleWindowKeydown(event) {
    if (!viewerOpen) return;
    if (event.key === "Escape") {
      closePhotoViewer();
      return;
    }
    if (event.key === "ArrowLeft") {
      showPrevPhoto();
      return;
    }
    if (event.key === "ArrowRight") {
      showNextPhoto();
    }
  }

  function pickFromGallery() {
    galleryInputRef?.click();
  }

  async function openCameraCapture() {
    uploadError = "";
    cameraError = "";

    try {
      await startCameraStream();
    } catch (err) {
      cameraError = parseError(err, "Không thể mở camera trên thiết bị này.");
      // Fallback for browsers that only support capture via file input.
      cameraInputRef?.click();
    }
  }

  function onFileSelected(event) {
    const file = event.currentTarget?.files?.[0];
    if (!file) return;

    if (!String(file.type || "").startsWith("image/")) {
      uploadError = "Vui lòng chọn file ảnh hợp lệ.";
      clearPreview();
      return;
    }

    uploadError = "";
    setSelectedFile(file);
  }

  function guessExtFromType(mimeType) {
    const mime = String(mimeType || "").toLowerCase();
    if (mime.includes("png")) return "png";
    if (mime.includes("webp")) return "webp";
    return "jpg";
  }

  // Nén ảnh bằng canvas để giảm dung lượng upload trên mobile/PWA.
  async function compressImage(file, { maxWidth = 1600, maxHeight = 1600, quality = 0.82 } = {}) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Không thể đọc ảnh."));
        image.src = objectUrl;
      });

      const srcWidth = img.width || 1;
      const srcHeight = img.height || 1;
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
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((value) => {
          if (!value) {
            reject(new Error("Không thể nén ảnh."));
            return;
          }
          resolve(value);
        }, "image/jpeg", quality);
      });

      return new File([blob], `lingo-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function uploadPhoto() {
    uploadError = "";

    if (!uploadAlbumId) {
      uploadError = "Vui lòng chọn album.";
      return;
    }
    if (!selectedFile) {
      uploadError = "Vui lòng chọn ảnh trước khi tải lên.";
      return;
    }

    uploadBusy = true;

    try {
      const compressedFile = await compressImage(selectedFile);
      const ext = guessExtFromType(compressedFile.type);
      const filePath = `${uploadAlbumId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, compressedFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: compressedFile.type,
        });
      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
      const publicUrl = String(publicData?.publicUrl || "").trim();
      if (!publicUrl) {
        throw new Error("Không thể lấy URL công khai của ảnh.");
      }

      const { data: insertedPhoto, error: insertErr } = await supabase
        .from("photos")
        .insert({
          album_id: uploadAlbumId,
          image_url: publicUrl,
          note: String(uploadNote || "").trim() || null,
        })
        .select("id,album_id,image_url,note,created_at")
        .single();
      if (insertErr) throw insertErr;

      const selectedAlbum = albums.find((a) => a.id === uploadAlbumId);
      if (!String(selectedAlbum?.cover_image_url || "").trim()) {
        const { error: coverErr } = await supabase
          .from("albums")
          .update({ cover_image_url: publicUrl })
          .eq("id", uploadAlbumId);
        if (!coverErr) {
          albums = albums.map((a) => (a.id === uploadAlbumId ? { ...a, cover_image_url: publicUrl } : a));
        }
      }

      if (uploadAlbumId === activeAlbumId && insertedPhoto) {
        photos = [insertedPhoto, ...photos];
      } else {
        activeAlbumId = uploadAlbumId;
        await loadPhotos(uploadAlbumId);
      }

      albumModalOpen = true;
      closeUploadModal();
      dispatch("toast", "Đã thêm ảnh mới vào album.");
    } catch (err) {
      uploadError = parseError(err, "Không thể tải ảnh lên.");
    } finally {
      uploadBusy = false;
    }
  }

  onMount(() => {
    initGallery();
  });

  onDestroy(() => {
    stopCameraStream();
    clearPreview();
  });
</script>

<svelte:window on:keydown={handleWindowKeydown} />

<section class="card rounded-3xl p-4 sm:p-5" aria-labelledby="galleryTitle">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Gallery Together</p>
      <h2 id="galleryTitle" class="text-xl font-extrabold text-[color:var(--ink)]">Album Kỷ niệm</h2>
      <p class="text-sm text-[color:var(--ink2)]">Lưu lại khoảnh khắc của hai bạn theo từng album.</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button type="button" class="btn btn-primary text-sm" on:click={openCreateAlbumModal}>+ Tạo album mới</button>
    </div>
  </div>

  {#if errorText}
    <p class="mt-3 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{errorText}</p>
  {/if}

  <div class="mt-4">
    {#if loadingAlbums}
      <div class="rounded-2xl border border-pink-100/80 bg-white/70 p-4 text-sm text-[color:var(--ink2)]">Đang tải album...</div>
    {:else if !albums.length}
      <div class="rounded-2xl border border-pink-100/80 bg-white/70 p-5 text-center">
        <p class="text-base font-semibold text-[color:var(--ink)]">Chưa có album nào</p>
        <p class="mt-1 text-sm text-[color:var(--ink2)]">Tạo album đầu tiên để bắt đầu lưu kỷ niệm.</p>
        <button type="button" class="btn btn-primary text-sm mt-3" on:click={openCreateAlbumModal}>+ Tạo album mới</button>
      </div>
    {:else}
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {#each albums as album}
          <button
            type="button"
            class="group overflow-hidden rounded-2xl border border-pink-100/80 bg-white/75 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            on:click={() => openAlbum(album.id)}
          >
            <div class="aspect-square overflow-hidden bg-pink-50/70">
              <img src={albumCoverUrl(album)} alt={album.name} class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" loading="lazy" />
            </div>
            <div class="px-3 py-2">
              <p class="line-clamp-2 text-sm font-bold text-[color:var(--ink)]">{album.name}</p>
              <p class="mt-1 text-xs text-[color:var(--ink2)]">{formatDate(album.created_at)}</p>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</section>

<div class={`modal ${albumModalOpen ? "open" : ""}`} aria-hidden={!albumModalOpen} on:click|self={closeAlbumModal}>
  <div class="modal-card max-w-6xl" role="dialog" aria-modal="true" aria-labelledby="albumPhotosTitle" tabindex="-1">
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-pink-100/70 px-4 py-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.14em] text-pink-500/80">Album</p>
        <h3 id="albumPhotosTitle" class="text-lg font-bold text-[color:var(--ink)]">{activeAlbum()?.name || "Album kỷ niệm"}</h3>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="inline-flex rounded-full border border-pink-100/80 bg-white/70 p-1" role="group" aria-label="Chọn kiểu hiển thị ảnh">
          <button
            type="button"
            class={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              albumLayout === "pinterest"
                ? "bg-pink-500 text-white shadow-sm shadow-pink-300/40"
                : "text-[color:var(--ink2)]"
            }`}
            aria-pressed={albumLayout === "pinterest"}
            on:click={() => (albumLayout = "pinterest")}
          >
            Kiểu Pinterest
          </button>
          <button
            type="button"
            class={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              albumLayout === "locket"
                ? "bg-pink-500 text-white shadow-sm shadow-pink-300/40"
                : "text-[color:var(--ink2)]"
            }`}
            aria-pressed={albumLayout === "locket"}
            on:click={() => (albumLayout = "locket")}
          >
            Kiểu Locket
          </button>
        </div>
        <button type="button" class="btn btn-primary text-sm" on:click={openUploadModal}>+ Thêm ảnh</button>
        <button type="button" class="btn btn-soft text-sm" on:click={closeAlbumModal}>Đóng</button>
      </div>
    </div>

    <div class="max-h-[76vh] overflow-y-auto px-4 py-4">
      {#if loadingPhotos}
        <div class="rounded-2xl border border-pink-100/80 bg-white/70 p-4 text-sm text-[color:var(--ink2)]">Đang tải ảnh...</div>
      {:else if !photos.length}
        <div class="rounded-2xl border border-dashed border-pink-200 bg-white/70 p-5 text-center">
          <p class="text-base font-semibold text-[color:var(--ink)]">Album chưa có ảnh</p>
          <p class="mt-1 text-sm text-[color:var(--ink2)]">Thêm ảnh đầu tiên bằng nút “+ Thêm ảnh”.</p>
        </div>
      {:else}
        {#if albumLayout === "pinterest"}
          <div class="columns-2 gap-3 sm:columns-3 [column-fill:_balance]">
            {#each photos as photo, idx}
              <article class="mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-pink-100/80 bg-white/85 shadow-sm">
                <button type="button" class="block w-full text-left" on:click={() => openPhotoViewer(photo, idx)}>
                  <img src={photo.image_url} alt={photo.note || "Ảnh kỷ niệm"} class="h-auto w-full object-cover" loading="lazy" />
                  <div class="px-3 py-2">
                    <p class="line-clamp-2 text-sm font-semibold text-[color:var(--ink)] break-words">{photo.note || "Không có ghi chú"}</p>
                    <p class="mt-1 text-xs text-[color:var(--ink2)]">{formatDateTime(photo.created_at)}</p>
                  </div>
                </button>
              </article>
            {/each}
          </div>
        {:else}
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {#each photos as photo, idx}
              <article class="overflow-hidden rounded-2xl border border-pink-100/80 bg-white/85 shadow-sm">
                <button type="button" class="block w-full text-left" on:click={() => openPhotoViewer(photo, idx)}>
                  <div class="aspect-square overflow-hidden bg-pink-50/60">
                    <img src={photo.image_url} alt={photo.note || "Ảnh kỷ niệm"} class="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div class="px-3 py-2">
                    <p class="line-clamp-2 text-sm font-semibold text-[color:var(--ink)] break-words">{photo.note || "Không có ghi chú"}</p>
                    <p class="mt-1 text-xs text-[color:var(--ink2)]">{formatDateTime(photo.created_at)}</p>
                  </div>
                </button>
              </article>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>

{#if albumModalOpen}
  <button
    type="button"
    class="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-pink-300/40 bg-gradient-to-br from-pink-400 to-rose-500 text-white shadow-xl shadow-pink-300/50 transition active:scale-95"
    on:click={openUploadModal}
    aria-label="Thêm ảnh mới"
  >
    <span class="text-3xl leading-none">+</span>
  </button>
{/if}

<div class={`modal ${createModalOpen ? "open" : ""}`} aria-hidden={!createModalOpen} on:click|self={closeCreateAlbumModal}>
  <div class="modal-card max-w-lg" role="dialog" aria-modal="true" aria-labelledby="createAlbumTitle" tabindex="-1">
    <div class="border-b border-pink-100/70 px-4 py-3">
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Album mới</p>
      <h3 id="createAlbumTitle" class="text-lg font-bold text-[color:var(--ink)]">Tạo album kỷ niệm</h3>
    </div>

    <div class="space-y-3 px-4 py-4">
      <div>
        <label class="label" for="album_name">Tên album</label>
        <input id="album_name" class="field mt-1 text-sm" type="text" maxlength="120" bind:value={createName} placeholder="Ví dụ: Chuyến đi Đà Lạt" />
      </div>
      <div>
        <label class="label" for="album_cover">Ảnh bìa (URL - tùy chọn)</label>
        <input id="album_cover" class="field mt-1 text-sm" type="url" bind:value={createCoverUrl} placeholder="https://..." />
      </div>
    </div>

    <div class="flex justify-end gap-2 border-t border-pink-100/70 px-4 py-3">
      <button type="button" class="btn btn-soft text-sm" on:click={closeCreateAlbumModal}>Hủy</button>
      <button type="button" class="btn btn-primary text-sm" on:click={createAlbum} disabled={createBusy}>
        {createBusy ? "Đang tạo..." : "Tạo album"}
      </button>
    </div>
  </div>
</div>

<div class={`modal ${uploadModalOpen ? "open" : ""}`} aria-hidden={!uploadModalOpen} on:click|self={closeUploadModal}>
  <div class="modal-card relative max-w-xl" role="dialog" aria-modal="true" aria-labelledby="uploadPhotoTitle" tabindex="-1">
    {#if uploadBusy}
      <div class="absolute inset-0 z-10 flex items-center justify-center bg-white/75 backdrop-blur-sm">
        <div class="rounded-2xl border border-pink-100/80 bg-white px-5 py-4 text-center shadow-lg">
          <div class="text-3xl animate-bounce">🦩</div>
          <p class="mt-2 text-sm font-semibold text-[color:var(--ink)] animate-pulse">Đang tải ảnh lên...</p>
        </div>
      </div>
    {/if}

    <div class="border-b border-pink-100/70 px-4 py-3">
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Thêm ảnh</p>
      <h3 id="uploadPhotoTitle" class="text-lg font-bold text-[color:var(--ink)]">Thêm ảnh kỷ niệm mới</h3>
    </div>

    <div class="space-y-4 px-4 py-4 max-h-[72vh] overflow-y-auto">
      <div class="rounded-2xl border border-dashed border-pink-200 bg-white/75 p-3">
        <p class="text-sm font-semibold text-[color:var(--ink)]">Ảnh từ thư viện hoặc camera</p>
        <p class="mt-1 text-xs text-[color:var(--ink2)]">Hỗ trợ iOS Safari và Android Chrome.</p>

        <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" class="btn btn-soft text-sm w-full" on:click={pickFromGallery}>Chọn từ thư viện</button>
          <button type="button" class="btn btn-soft text-sm w-full" on:click={openCameraCapture} disabled={cameraBusy}>
            {cameraBusy ? "Đang mở camera..." : "Mở camera"}
          </button>
        </div>

        <input bind:this={galleryInputRef} type="file" accept="image/*" class="hidden" on:change={onFileSelected} />
        <input bind:this={cameraInputRef} type="file" accept="image/*" capture="environment" class="hidden" on:change={onFileSelected} />

        {#if cameraOpen}
          <div class="mt-3 overflow-hidden rounded-xl border border-pink-100 bg-black">
            <video bind:this={cameraVideoRef} autoplay playsinline muted class="h-auto w-full object-cover"></video>
          </div>
          <p class="mt-2 text-xs text-[color:var(--ink2)]">
            Đang dùng: {cameraFacing === "environment" ? "camera sau" : "camera trước"}
          </p>
          <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" class="btn btn-primary text-sm w-full" on:click={captureCameraFrame}>Chụp ảnh</button>
            <button type="button" class="btn btn-soft text-sm w-full" on:click={toggleCameraFacing} disabled={cameraBusy}>
              {cameraBusy ? "Đang đổi camera..." : cameraFacing === "environment" ? "Đổi sang camera trước" : "Đổi sang camera sau"}
            </button>
            <button type="button" class="btn btn-soft text-sm w-full sm:col-span-2" on:click={stopCameraStream}>Đóng camera</button>
          </div>
        {/if}

        {#if cameraError}
          <p class="mt-2 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            {cameraError}
          </p>
        {/if}

        {#if previewUrl}
          <div class="mt-3 overflow-hidden rounded-xl border border-pink-100 bg-white">
            <img src={previewUrl} alt="Xem trước ảnh" class="max-h-72 w-full object-contain" />
          </div>
        {/if}
      </div>

      <div>
        <label class="label" for="upload_album">Chọn album</label>
        <select id="upload_album" class="field mt-1 text-sm" bind:value={uploadAlbumId}>
          {#each albums as album}
            <option value={album.id}>{album.name}</option>
          {/each}
        </select>
      </div>

      <div>
        <label class="label" for="upload_note">Ghi chú</label>
        <textarea
          id="upload_note"
          class="field mt-1 min-h-[96px] text-sm"
          maxlength="300"
          bind:value={uploadNote}
          placeholder="Viết vài dòng cho khoảnh khắc này..."
        ></textarea>
        <p class="mt-1 text-xs text-[color:var(--ink2)]">{uploadNote.length}/300 ký tự</p>
      </div>

      {#if uploadError}
        <p class="rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{uploadError}</p>
      {/if}
    </div>

    <div class="flex justify-end gap-2 border-t border-pink-100/70 px-4 py-3">
      <button type="button" class="btn btn-soft text-sm" on:click={closeUploadModal} disabled={uploadBusy}>Hủy</button>
      <button type="button" class="btn btn-primary text-sm" on:click={uploadPhoto} disabled={uploadBusy}>
        {uploadBusy ? "Đang tải..." : "Tải ảnh lên"}
      </button>
    </div>
  </div>
</div>

<div class={`modal ${viewerOpen ? "open" : ""}`} aria-hidden={!viewerOpen} on:click|self={closePhotoViewer}>
  <div class="modal-card flex max-h-[92vh] max-w-5xl flex-col" role="dialog" aria-modal="true" aria-labelledby="viewerTitle" tabindex="-1">
    <div class="flex items-center justify-between border-b border-pink-100/70 px-4 py-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Xem ảnh</p>
        <h3 id="viewerTitle" class="text-lg font-bold text-[color:var(--ink)]">{activeAlbum()?.name || "Album kỷ niệm"}</h3>
      </div>
      <button type="button" class="btn btn-soft text-sm" on:click={closePhotoViewer}>Đóng</button>
    </div>

    {#if viewerPhoto}
      <div class="space-y-3 px-3 py-3 sm:px-4">
        <div class="flex min-h-[220px] max-h-[calc(92vh-14rem)] items-center justify-center overflow-hidden rounded-2xl border border-pink-100/80 bg-black/90">
          <img src={viewerPhoto.image_url} alt={viewerPhoto.note || "Ảnh kỷ niệm"} class="max-h-[72vh] w-full object-contain" />
        </div>

        <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-pink-100/80 bg-white/80 px-3 py-2">
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-[color:var(--ink)]">{viewerPhoto.note || "Không có ghi chú"}</p>
            <p class="mt-1 text-xs text-[color:var(--ink2)]">{formatDateTime(viewerPhoto.created_at)}</p>
          </div>

          {#if photos.length > 1}
            <div class="flex shrink-0 gap-2">
              <button type="button" class="btn btn-soft text-sm" on:click={showPrevPhoto}>← Trước</button>
              <button type="button" class="btn btn-soft text-sm" on:click={showNextPhoto}>Sau →</button>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
