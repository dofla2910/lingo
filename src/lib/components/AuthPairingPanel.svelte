<script>
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import {
    createPairRoom,
    getCurrentAuthUser,
    getEnabledAuthProviders,
    getMyPairRoom,
    getSupabaseClient,
    getSupabaseConfigError,
    isSchemaMissingError,
    isSupabaseConfigured,
    joinPairRoom,
    mapRoomRowToDto,
    sanitizeRoomCode,
    signInWithProvider,
    signOutAuth,
  } from "../lingo/supabaseClient.js";

  export let currentRoomId = "";
  export let syncStatus = "connecting";
  export let hasStartDate = false;

  const dispatch = createEventDispatcher();

  let loading = true;
  let authBusy = false;
  let pairBusy = false;
  let me = null;
  let room = null;
  let providers = [];
  let authConfigured = false;
  let joinCode = "";
  let errorText = "";
  let infoText = "";
  let providerPickerOpen = false;
  let providerPickerReason = "";
  let pendingAutoPairAfterAuth = false;
  let autoPairRequestedFromQuery = false;
  let authSubscription = null;

  function emitToast(message) {
    if (!message) return;
    dispatch("toast", message);
  }

  function normalizeCode(value) {
    return sanitizeRoomCode(value);
  }

  function providerIcon(id) {
    const k = String(id || "").toLowerCase();
    if (k === "instagram") return "📸";
    if (k === "facebook") return "📘";
    if (k === "google") return "🔎";
    if (k === "github") return "🐙";
    if (k === "discord") return "🎮";
    if (k === "apple") return "🍎";
    return "🔐";
  }

  function providerName(id, fallback = "") {
    const k = String(id || "").toLowerCase();
    if (fallback) return fallback;
    if (k === "instagram") return "Instagram";
    if (k === "facebook") return "Facebook";
    if (k === "google") return "Google";
    if (k === "github") return "GitHub";
    if (k === "discord") return "Discord";
    if (k === "apple") return "Apple";
    return id || "OAuth";
  }

  function providerHint(id) {
    const k = String(id || "").toLowerCase();
    if (k === "instagram") return "Phù hợp nếu cả hai thường dùng Instagram. Tùy cấu hình Supabase/Auth provider.";
    if (k === "facebook") return "Dễ dùng cho đa số người dùng, thuận tiện chia sẻ mã ghép cặp.";
    if (k === "google") return "Đăng nhập nhanh, thường ổn định với callback URL.";
    if (k === "github") return "Tiện cho tài khoản kỹ thuật / dev.";
    if (k === "discord") return "Nhanh cho cặp đôi dùng Discord.";
    if (k === "apple") return "Phù hợp hệ sinh thái Apple, cần cấu hình provider trước.";
    return "Đăng nhập OAuth để tạo hoặc tham gia phòng cặp đôi.";
  }

  function providerAccent(id) {
    const k = String(id || "").toLowerCase();
    if (k === "instagram") return "from-pink-400/25 to-orange-300/25";
    if (k === "facebook") return "from-blue-400/25 to-sky-300/25";
    if (k === "google") return "from-emerald-300/20 to-rose-300/20";
    if (k === "github") return "from-slate-400/20 to-zinc-300/20";
    if (k === "discord") return "from-indigo-400/25 to-violet-300/25";
    if (k === "apple") return "from-zinc-300/20 to-slate-300/20";
    return "from-pink-300/20 to-rose-200/20";
  }

  function toErrorMessage(err, fallback = "Không thể thực hiện thao tác.") {
    const msg = String(err?.message || err || fallback);
    const lower = msg.toLowerCase();

    if (isSchemaMissingError?.(err)) {
      return "Thiếu bảng/hàm Supabase cho Lingo. Hãy chạy file supabase/lingo_schema.sql.";
    }
    if (msg.includes("UNAUTHENTICATED")) return "Vui lòng đăng nhập trước.";
    if (msg.includes("INVALID_CODE")) return "Mã ghép cặp không hợp lệ (cần đúng 6 ký tự).";
    if (msg.includes("CODE_NOT_FOUND_OR_EXPIRED")) return "Mã không tồn tại hoặc đã hết hạn.";
    if (msg.includes("ROOM_ALREADY_HAS_2_PEOPLE")) return "Phòng này đã đủ 2 người.";
    if (lower.includes("row-level security") || lower.includes("permission denied")) {
      return "Supabase từ chối truy cập (RLS). Hãy kiểm tra policy hoặc đăng nhập lại.";
    }
    if (lower.includes("failed to fetch") || lower.includes("network")) {
      return "Không thể kết nối Supabase. Hãy kiểm tra mạng.";
    }
    if (lower.includes("supabase chưa cấu hình") || lower.includes("vite_supabase_")) {
      return msg;
    }
    return msg || fallback;
  }

  function clearMessages() {
    errorText = "";
    infoText = "";
  }

  async function refreshAuthPairState() {
    loading = true;
    errorText = "";

    providers = getEnabledAuthProviders();
    authConfigured = isSupabaseConfigured();
    const cfgErr = getSupabaseConfigError();
    if (cfgErr) {
      me = null;
      room = null;
      if (!joinCode && currentRoomId) joinCode = normalizeCode(currentRoomId);
      errorText = `Supabase chưa cấu hình: ${cfgErr}`;
      loading = false;
      return;
    }

    try {
      const client = getSupabaseClient();
      me = await getCurrentAuthUser(client);

      if (me) {
        const roomRow = await getMyPairRoom(client).catch((err) => {
          if (String(err?.message || "").includes("0 rows")) return null;
          throw err;
        });
        room = mapRoomRowToDto(roomRow, me.id);
      } else {
        room = null;
      }

      if (room?.code) {
        joinCode = String(room.code).toUpperCase();
      } else if (!joinCode && currentRoomId) {
        joinCode = normalizeCode(currentRoomId);
      }
    } catch (err) {
      errorText = toErrorMessage(err, "Không thể tải trạng thái đăng nhập.");
    } finally {
      loading = false;
    }
  }

  function openProviderPicker(options = {}) {
    const cfgErr = getSupabaseConfigError();
    if (cfgErr) {
      errorText = `Supabase chưa cấu hình: ${cfgErr}`;
      return;
    }
    if (!providers.length) {
      errorText = "Chưa bật provider đăng nhập nào. Hãy cấu hình VITE_SUPABASE_PROVIDERS.";
      return;
    }
    providerPickerReason = String(options.reason || "");
    if (options.autoPair) pendingAutoPairAfterAuth = true;
    providerPickerOpen = true;
  }

  function closeProviderPicker() {
    if (authBusy) return;
    providerPickerOpen = false;
  }

  function handleKeydown(event) {
    if (event.key !== "Escape") return;
    if (providerPickerOpen) {
      event.preventDefault();
      closeProviderPicker();
    }
  }

  function consumeAuthQueryFlags() {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    let changed = false;

    const authOk = url.searchParams.get("auth");
    const authErr = url.searchParams.get("auth_error") || url.searchParams.get("error");
    const autoPair = url.searchParams.get("autoPair");

    if (autoPair === "create") {
      autoPairRequestedFromQuery = true;
      pendingAutoPairAfterAuth = true;
      url.searchParams.delete("autoPair");
      changed = true;
    }

    if (authOk) {
      emitToast("Đăng nhập thành công.");
      url.searchParams.delete("auth");
      changed = true;
    }

    if (authErr) {
      errorText = `Đăng nhập lỗi: ${authErr}`;
      url.searchParams.delete("auth_error");
      url.searchParams.delete("error");
      changed = true;
    }

    if (changed) history.replaceState({}, "", url);
  }

  function buildAuthRedirectUrl() {
    const callbackUrl = new URL(window.location.href);
    callbackUrl.searchParams.set("auth", "oauth_ok");
    if (pendingAutoPairAfterAuth) {
      callbackUrl.searchParams.set("autoPair", "create");
    }
    return callbackUrl.toString();
  }

  async function startAuthLogin(providerId) {
    const pid = String(providerId || "").trim();
    if (!pid) return;

    authBusy = true;
    errorText = "";

    try {
      const client = getSupabaseClient();
      const redirectTo = buildAuthRedirectUrl();
      const data = await signInWithProvider(pid, { redirectTo }, client);
      providerPickerOpen = false;

      if (data?.url && typeof window !== "undefined") {
        window.location.assign(data.url);
        return;
      }

      authBusy = false;
      infoText = "Đã gửi yêu cầu đăng nhập. Nếu chưa chuyển trang, hãy kiểm tra cấu hình provider.";
    } catch (err) {
      authBusy = false;
      errorText = toErrorMessage(err, "Không thể bắt đầu đăng nhập.");
    }
  }

  async function logout() {
    authBusy = true;
    clearMessages();
    try {
      const client = getSupabaseClient();
      await signOutAuth(client);
      me = null;
      room = null;
      joinCode = "";
      pendingAutoPairAfterAuth = false;
      autoPairRequestedFromQuery = false;
      infoText = "Đã đăng xuất.";
      emitToast("Đã đăng xuất.");
      dispatch("refreshroom", { clearRoomQuery: true });
    } catch (err) {
      errorText = toErrorMessage(err, "Không thể đăng xuất.");
    } finally {
      authBusy = false;
    }
  }

  async function createPairCode(options = {}) {
    if (pairBusy || authBusy) return null;

    if (!me) {
      if (options.auto) {
        infoText = "Đã lưu Wizard. Hãy đăng nhập để hệ thống tự tạo mã ghép cặp.";
        emitToast("Đăng nhập để tạo mã ghép cặp.");
        openProviderPicker({ reason: "wizard-auto", autoPair: true });
        return null;
      }
      errorText = "Vui lòng đăng nhập trước.";
      return null;
    }

    if (!hasStartDate) {
      errorText = "Hãy hoàn tất Wizard (ngày bắt đầu yêu) trước khi tạo mã ghép cặp.";
      dispatch("openwizard");
      return null;
    }

    pairBusy = true;
    errorText = "";
    if (!options.keepInfo) infoText = "";

    try {
      const client = getSupabaseClient();
      const row = await createPairRoom(me, client);
      const nextRoom = mapRoomRowToDto(row, me.id);
      if (!nextRoom?.code) throw new Error("Không nhận được mã ghép cặp từ Supabase.");

      const reused = !!room?.code && room.code === nextRoom.code;
      room = nextRoom;
      joinCode = String(nextRoom.code).toUpperCase();
      providerPickerOpen = false;
      pendingAutoPairAfterAuth = false;
      autoPairRequestedFromQuery = false;

      if (options.auto) {
        infoText = `Mã ghép cặp đã sẵn sàng: ${joinCode}. Gửi cho người kia để tham gia.`;
      }

      emitToast(reused ? `Dùng lại mã phòng: ${joinCode}` : `Đã tạo mã ghép cặp: ${joinCode}`);
      dispatch("roomconnect", {
        roomId: nextRoom.code,
        code: nextRoom.code,
        room: nextRoom,
        source: reused ? "reuse" : "create",
      });
      return nextRoom;
    } catch (err) {
      errorText = toErrorMessage(err, "Không thể tạo mã ghép cặp.");
      return null;
    } finally {
      pairBusy = false;
    }
  }

  async function joinPairCode() {
    const code = normalizeCode(joinCode);
    joinCode = code;

    if (code.length !== 6) {
      errorText = "Mã ghép cặp phải gồm 6 ký tự.";
      return;
    }
    if (!me) {
      errorText = "Vui lòng đăng nhập trước.";
      return;
    }

    pairBusy = true;
    clearMessages();

    try {
      const client = getSupabaseClient();
      const row = await joinPairRoom(code, me, client);
      const nextRoom = mapRoomRowToDto(row, me.id);
      if (!nextRoom) throw new Error("Không thể nhận thông tin phòng sau khi ghép cặp.");

      room = nextRoom;
      pendingAutoPairAfterAuth = false;
      autoPairRequestedFromQuery = false;

      if (nextRoom.isOwner) {
        infoText = `Bạn đang dùng chính mã phòng ${code}. Hãy gửi mã này cho người kia.`;
      } else {
        emitToast(`Đã ghép cặp vào phòng ${code}.`);
      }

      dispatch("roomconnect", {
        roomId: nextRoom.code,
        code: nextRoom.code,
        room: nextRoom,
        source: nextRoom.isOwner ? "self-room" : "join",
      });
    } catch (err) {
      errorText = toErrorMessage(err, "Không thể ghép cặp.");
    } finally {
      pairBusy = false;
    }
  }

  async function copyRoomLink() {
    const code = room?.code || "";
    if (!code || typeof window === "undefined") return;

    const url = new URL(window.location.href);
    url.searchParams.set("room", code);
    url.searchParams.delete("code");
    const text = url.toString();

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("Clipboard API not available");
      }
      emitToast("Đã copy link phòng để gửi cho người kia.");
    } catch {
      infoText = `Link phòng: ${text}`;
    }
  }

  function reconnectCurrentRoom() {
    const roomId = room?.code || currentRoomId || "";
    if (!roomId) return;
    dispatch("roomconnect", {
      roomId,
      code: roomId,
      room,
      source: "manual",
    });
  }

  export async function handleWizardCompletedAutoPair() {
    errorText = "";
    await refreshAuthPairState();

    if (room?.code) {
      if ((room.roomId || room.code) !== currentRoomId) {
        dispatch("roomconnect", {
          roomId: room.roomId || room.code,
          code: room.code,
          room,
          source: "wizard-existing-room",
        });
      }
      infoText = `Bạn đã có mã phòng ${room.code}. Gửi cho người kia để ghép cặp.`;
      emitToast(`Mã phòng hiện tại: ${room.code}`);
      return;
    }

    if (!me) {
      infoText =
        "Đã lưu Wizard. Chọn nhà cung cấp để đăng nhập, hệ thống sẽ tự tạo mã ghép cặp sau khi quay lại.";
      emitToast("Chọn cách đăng nhập để tạo mã ghép cặp.");
      openProviderPicker({ reason: "wizard-auto", autoPair: true });
      return;
    }

    if (!hasStartDate) return;
    await createPairCode({ auto: true, keepInfo: false });
  }

  function setupAuthStateListener() {
    try {
      const client = getSupabaseClient();
      const result = client.auth.onAuthStateChange((_event, _session) => {
        refreshAuthPairState().catch((err) => {
          console.error(err);
          errorText = toErrorMessage(err, "Không thể cập nhật trạng thái đăng nhập.");
        });
      });
      authSubscription = result?.data?.subscription || null;
    } catch {
      authSubscription = null;
    }
  }

  onMount(async () => {
    consumeAuthQueryFlags();
    await refreshAuthPairState();
    setupAuthStateListener();

    if (autoPairRequestedFromQuery && me && hasStartDate && !room) {
      await createPairCode({ auto: true, keepInfo: false });
    } else if (autoPairRequestedFromQuery && !me) {
      infoText = "Đăng nhập chưa hoàn tất. Hãy chọn lại nhà cung cấp.";
      openProviderPicker({ reason: "auth-return", autoPair: true });
    }
  });

  onDestroy(() => {
    try {
      authSubscription?.unsubscribe?.();
    } catch {
      // noop
    }
  });

  $: effectiveRoomCode = room?.code || currentRoomId || "";
  $: needsConnect = !!effectiveRoomCode && currentRoomId !== effectiveRoomCode;
  $: providerSummary = providers.length ? providers.map((p) => providerName(p.id, p.name)).join(", ") : "";
  $: canShowProviderTrigger = authConfigured && providers.length > 0 && !me;
</script>

<svelte:window on:keydown={handleKeydown} />

<section class="card rounded-3xl p-4 sm:p-5">
  <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[.18em] text-pink-500/80">Kết nối cặp đôi</p>
      <h2 class="mt-1 text-lg sm:text-xl font-extrabold text-[color:var(--ink)]">Đăng nhập Supabase Auth & ghép cặp phòng dữ liệu</h2>
      <p class="mt-1 text-sm text-[color:var(--ink2)]">
        Đăng nhập bằng OAuth (Facebook, Google, GitHub, Instagram... tùy provider bạn bật trên Supabase) rồi tạo hoặc tham gia
        phòng 2 người.
      </p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button class="btn btn-soft text-sm" type="button" on:click={refreshAuthPairState} disabled={loading || authBusy || pairBusy}>
        {loading ? "Đang tải..." : "Làm mới"}
      </button>
      {#if me}
        <button
          class="btn btn-soft text-sm"
          type="button"
          on:click={() => openProviderPicker({ reason: "switch-account" })}
          disabled={authBusy || pairBusy || !providers.length}
        >
          Đổi tài khoản
        </button>
        <button class="btn btn-soft text-sm" type="button" on:click={logout} disabled={authBusy || pairBusy}>
          {authBusy ? "Đang thoát..." : "Đăng xuất"}
        </button>
      {:else if canShowProviderTrigger}
        <button class="btn btn-primary text-sm" type="button" on:click={() => openProviderPicker({ reason: "manual-login" })} disabled={authBusy || pairBusy}>
          {authBusy ? "Đang chuyển..." : "Chọn cách đăng nhập"}
        </button>
      {/if}
    </div>
  </div>

  <div class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
    <div class="xl:col-span-5 rounded-2xl border border-white/70 bg-white/65 p-4">
      <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Tài khoản</p>

      {#if loading}
        <p class="mt-2 text-sm text-[color:var(--ink2)]">Đang kiểm tra phiên đăng nhập...</p>
      {:else if me}
        <div class="mt-2 space-y-2">
          <div class="flex items-center gap-3">
            <div class="avatar-wrap">
              <div class="h-10 w-10 rounded-xl bg-white/90 flex items-center justify-center text-lg">
                {providerIcon(me.provider)}
              </div>
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-[color:var(--ink)] truncate">@{me.username}</p>
              <p class="text-xs text-[color:var(--ink2)]">Đăng nhập qua {providerName(me.provider)}</p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 text-xs">
            <span class="pill">Phiên: hoạt động</span>
            <span class="pill">
              Đồng bộ: {syncStatus === "synced" ? "sẵn sàng" : syncStatus === "saving" ? "đang lưu" : syncStatus === "error" ? "lỗi" : syncStatus === "draft" ? "chưa ghép phòng" : "đang kết nối"}
            </span>
          </div>
        </div>
      {:else}
        <div class="mt-2 rounded-xl border border-dashed border-pink-200 bg-white/55 px-3 py-3">
          <p class="text-sm font-medium text-[color:var(--ink)]">Chưa đăng nhập</p>
          <p class="mt-1 text-sm text-[color:var(--ink2)]">
            Chọn một nhà cung cấp để đăng nhập, sau đó tạo mã 6 ký tự hoặc nhập mã do người kia gửi.
          </p>
          {#if canShowProviderTrigger}
            <button class="btn btn-primary mt-3 text-sm" type="button" on:click={() => openProviderPicker({ reason: "account-card" })}>
              Mở popup chọn provider
            </button>
          {/if}
        </div>
      {/if}

      <div class="mt-3">
        <p class="text-xs font-semibold uppercase tracking-[.12em] text-pink-500/80">Nhà cung cấp đăng nhập</p>
        {#if !authConfigured}
          <p class="mt-2 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Chưa cấu hình <code>VITE_SUPABASE_URL</code> / <code>VITE_SUPABASE_ANON_KEY</code>.
          </p>
        {:else if !providers.length}
          <p class="mt-2 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Chưa bật provider nào trong <code>VITE_SUPABASE_PROVIDERS</code>.
          </p>
        {:else}
          <div class="mt-2 flex flex-wrap gap-2">
            {#each providers as provider}
              <span class="pill">
                <span aria-hidden="true">{providerIcon(provider.id)}</span>
                {providerName(provider.id, provider.name)}
              </span>
            {/each}
          </div>
          <p class="mt-2 text-xs text-[color:var(--ink2)]">Supabase Auth providers: {providerSummary}</p>
        {/if}
      </div>
    </div>

    <div class="xl:col-span-7 rounded-2xl border border-white/70 bg-white/65 p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Ghép cặp</p>
          <p class="mt-1 text-sm text-[color:var(--ink2)]">
            {#if room}
              Mã hiện tại: <span class="font-bold text-[color:var(--ink)]">{room.code}</span>
              ({room.status === "paired" ? "đã đủ 2 người" : "đang chờ người kia"})
            {:else}
              Chưa có phòng. Bạn có thể tạo mã mới hoặc nhập mã để tham gia.
            {/if}
          </p>
        </div>
        {#if room}
          <span class="pill">{room.status === "paired" ? "Đã ghép cặp" : "Chờ ghép cặp"}</span>
        {/if}
      </div>

      {#if room}
        <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="rounded-xl border border-white/70 bg-white/70 px-3 py-3">
            <p class="text-xs font-semibold uppercase tracking-[.12em] text-pink-500/80">Chủ phòng</p>
            <p class="mt-1 text-sm font-semibold text-[color:var(--ink)]">{room.owner?.username ? `@${room.owner.username}` : "—"}</p>
          </div>
          <div class="rounded-xl border border-white/70 bg-white/70 px-3 py-3">
            <p class="text-xs font-semibold uppercase tracking-[.12em] text-pink-500/80">Người ghép cặp</p>
            <p class="mt-1 text-sm font-semibold text-[color:var(--ink)]">{room.partner?.username ? `@${room.partner.username}` : "Chưa tham gia"}</p>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <button class="btn btn-soft text-sm" type="button" on:click={copyRoomLink} disabled={pairBusy || authBusy}>Copy link phòng</button>
          {#if needsConnect}
            <button class="btn btn-primary text-sm" type="button" on:click={reconnectCurrentRoom} disabled={pairBusy || authBusy}>
              Kết nối phòng {room.code}
            </button>
          {/if}
          {#if !hasStartDate}
            <button class="btn btn-soft text-sm" type="button" on:click={() => dispatch("openwizard")}>
              Mở Wizard để hoàn tất hồ sơ
            </button>
          {/if}
        </div>
      {/if}

      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <div>
          <label for="join_code" class="label">Nhập mã ghép cặp (6 ký tự)</label>
          <input
            id="join_code"
            class="field mt-1 text-sm uppercase tracking-[.2em] text-center"
            type="text"
            placeholder="ABC123"
            maxlength="6"
            bind:value={joinCode}
            on:input={(e) => (joinCode = normalizeCode(e.currentTarget.value))}
            disabled={pairBusy || authBusy}
          />
        </div>
        <button class="btn btn-soft text-sm" type="button" on:click={joinPairCode} disabled={pairBusy || authBusy || !me}>
          {pairBusy ? "Đang xử lý..." : "Tham gia"}
        </button>
        <button class="btn btn-primary text-sm" type="button" on:click={() => createPairCode()} disabled={pairBusy || authBusy || !me}>
          {pairBusy ? "Đang tạo..." : "Tạo mã"}
        </button>
      </div>

      {#if !hasStartDate}
        <p class="mt-2 text-xs text-[color:var(--ink2)]">
          Mẹo: nên hoàn tất Wizard trước để mã ghép cặp được tạo sau khi đã có hồ sơ tình yêu.
        </p>
      {/if}

      {#if room && room.status !== "paired"}
        <p class="mt-2 text-xs text-[color:var(--ink2)]">
          Gửi mã <strong>{room.code}</strong> hoặc link phòng cho người kia để ghép cặp.
        </p>
      {/if}

      {#if infoText}
        <p class="mt-3 rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-2 text-sm text-sky-700">{infoText}</p>
      {/if}
      {#if errorText}
        <p class="mt-3 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{errorText}</p>
      {/if}
    </div>
  </div>
</section>

<div class={`modal ${providerPickerOpen ? "open" : ""}`} aria-hidden={!providerPickerOpen} on:click|self={closeProviderPicker}>
  <div
    class="modal-card"
    role="dialog"
    aria-modal="true"
    aria-labelledby="providerPickerTitle"
    tabindex="-1"
    style="max-width: 46rem;"
  >
    <div class="flex items-center justify-between border-b border-pink-100/70 px-4 py-3 sm:px-5">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Đăng nhập</p>
        <h3 id="providerPickerTitle" class="text-lg font-bold text-[color:var(--ink)]">Chọn nhà cung cấp Supabase Auth</h3>
      </div>
      <button type="button" class="btn btn-soft text-sm" on:click={closeProviderPicker} disabled={authBusy}>Đóng</button>
    </div>

    <div class="max-h-[78vh] overflow-y-auto px-4 py-4 sm:px-5">
      <div class="rounded-2xl border border-white/70 bg-white/65 p-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="pill">OAuth đa provider</span>
          {#if pendingAutoPairAfterAuth}
            <span class="pill">Tự tạo mã sau đăng nhập</span>
          {/if}
        </div>
        <p class="mt-2 text-sm text-[color:var(--ink2)]">
          {#if pendingAutoPairAfterAuth}
            Sau khi đăng nhập xong và quay lại trang, Lingo sẽ tự tạo mã ghép cặp 6 ký tự cho bạn.
          {:else}
            Chọn một nhà cung cấp để đăng nhập vào hệ thống ghép cặp.
          {/if}
        </p>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {#each providers as provider}
          <button
            type="button"
            class="group relative overflow-hidden rounded-2xl border border-white/80 bg-white/80 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
            on:click={() => startAuthLogin(provider.id)}
            disabled={authBusy || pairBusy}
          >
            <div class={`pointer-events-none absolute inset-0 bg-gradient-to-br ${providerAccent(provider.id)}`}></div>
            <div class="relative">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="h-11 w-11 rounded-xl border border-white/90 bg-white/90 flex items-center justify-center text-xl shadow-sm">
                    {providerIcon(provider.id)}
                  </div>
                  <div>
                    <p class="text-sm font-bold text-[color:var(--ink)]">{providerName(provider.id, provider.name)}</p>
                    <p class="text-xs text-[color:var(--ink2)]">Đăng nhập OAuth</p>
                  </div>
                </div>
                <span class="pill text-[11px]">Chọn</span>
              </div>
              <p class="mt-3 text-xs leading-5 text-[color:var(--ink2)]">{providerHint(provider.id)}</p>
            </div>
          </button>
        {/each}
      </div>

      {#if providerPickerReason === "wizard-auto"}
        <p class="mt-4 rounded-xl border border-pink-200/80 bg-pink-50/80 px-3 py-2 text-sm text-pink-700">
          Wizard đã hoàn tất. Bước tiếp theo là đăng nhập để hệ thống tự tạo mã ghép cặp cho hai bạn.
        </p>
      {/if}
    </div>
  </div>
</div>
