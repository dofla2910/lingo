<script>
  import { createEventDispatcher } from "svelte";

  export let ultraMinimal = false;
  export let loading = true;
  export let authBusy = false;
  export let pairBusy = false;
  export let me = null;
  export let room = null;
  export let joinCode = "";
  export let hasStartDate = false;
  export let infoText = "";
  export let errorText = "";
  export let detailsExpanded = false;
  export let displayAccountName = "user";
  export let syncStatus = "connecting";
  export let authConfigured = false;
  export let canUsePasswordLogin = false;
  export let needsConnect = false;
  export let providerName = () => "";
  export let providerIcon = () => "🔐";

  const dispatch = createEventDispatcher();

  function syncStatusLabel() {
    if (syncStatus === "synced") return "Đã kết nối phòng";
    if (syncStatus === "saving") return "Đang lưu";
    if (syncStatus === "error") return "Lỗi kết nối";
    if (syncStatus === "draft") return "Chưa ghép phòng";
    return "Đang kiểm tra";
  }

  function onJoinCodeInput(event) {
    dispatch("joincodeinput", event.currentTarget.value);
  }

  function onRefresh() {
    dispatch("refresh");
  }

  function onLogout() {
    dispatch("logout");
  }

  function onOpenCredential() {
    dispatch("opencredential");
  }

  function onOpenProfile() {
    dispatch("openprofile");
  }

  function onJoinRoom() {
    dispatch("joinroom");
  }

  function onCreateRoom() {
    dispatch("createroom");
  }

  function onToggleDetails() {
    dispatch("toggledetails");
  }

  function onCopyLink() {
    dispatch("copylink");
  }

  function onReconnect() {
    dispatch("reconnect");
  }

  function onOpenWizard() {
    dispatch("openwizard");
  }
</script>

<section class="p-0" aria-busy={loading}>
  {#if loading}
    <div class="mt-2 rounded-2xl border border-white/70 bg-white/65 p-4 sm:p-5">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div class="rounded-2xl border border-white/70 bg-white/72 p-4">
          <div class="skl h-3 w-24"></div>
          <div class="skl mt-3 h-6 w-52 max-w-[90%]"></div>
          <div class="skl mt-3 h-3 w-full"></div>
          <div class="skl mt-2 h-3 w-4/5"></div>
          <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div class="skl h-10 w-full"></div>
            <div class="skl h-10 w-full"></div>
          </div>
        </div>
        <div class="rounded-2xl border border-white/70 bg-white/72 p-4">
          <div class="skl h-3 w-20"></div>
          <div class="skl mt-3 h-3 w-full"></div>
          <div class="skl mt-2 h-3 w-3/4"></div>
          <div class="skl mt-4 h-11 w-full"></div>
          <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div class="skl h-10 w-full"></div>
            <div class="skl h-10 w-full"></div>
          </div>
        </div>
      </div>
    </div>
  {:else}
    {#if !ultraMinimal}
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[.18em] text-pink-500/80">Kết nối cặp đôi</p>
        <h2 class="mt-1 text-lg sm:text-xl font-extrabold text-[color:var(--ink)]">Đăng nhập & ghép cặp</h2>
        <p class="mt-1 text-sm text-[color:var(--ink2)]">Tạo mã 6 ký tự hoặc nhập mã người kia gửi để dùng chung một phòng.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-soft text-sm w-full sm:w-auto" type="button" on:click={onRefresh} disabled={loading || authBusy || pairBusy}>
          {loading ? "Đang tải..." : "Làm mới"}
        </button>
        <button
          class={`btn text-sm w-full sm:w-auto ${me ? "btn-soft" : "btn-primary"}`}
          type="button"
          on:click={me ? onLogout : onOpenCredential}
          disabled={authBusy || pairBusy || (!me && !canUsePasswordLogin)}
        >
          {#if me}
            {authBusy ? "Đang thoát..." : "Đăng xuất"}
          {:else}
            {authBusy ? "Đang chuyển..." : "Đăng nhập"}
          {/if}
        </button>
      </div>
    </div>
    {/if}

  {#if ultraMinimal}
    <div class="mt-4 rounded-2xl border border-white/70 bg-white/65 p-3 sm:p-4">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
        <div class="min-w-0 xl:flex-1">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span class="pill">
              {#if loading}
                Đang kiểm tra
              {:else if me}
                {displayAccountName}
              {:else}
                Chưa đăng nhập
              {/if}
            </span>
            {#if me}
              <span class="pill">{providerName(me.provider)}</span>
            {/if}
            <span class="pill">{syncStatusLabel()}</span>
            {#if room}
              <span class="pill">Phòng {room.code}</span>
            {/if}
          </div>
          <p class="mt-2 text-sm text-[color:var(--ink2)] truncate">
            {#if room}
              {room.status === "paired"
                ? "Hai bạn đã ghép cặp và có thể dùng chung dữ liệu."
                : `Phòng ${room.code} đang chờ người kia tham gia.`}
            {:else}
              Nhập mã 6 ký tự hoặc tạo mã mới để bắt đầu dùng chung một phòng.
            {/if}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button class="btn btn-soft text-sm" type="button" on:click={onRefresh} disabled={loading || authBusy || pairBusy}>
              {loading ? "Đang tải..." : "Làm mới"}
            </button>
            <button
              class={`btn text-sm ${me ? "btn-soft" : "btn-primary"}`}
              type="button"
              on:click={me ? onLogout : onOpenCredential}
              disabled={authBusy || pairBusy || (!me && !canUsePasswordLogin)}
            >
              {#if me}
                {authBusy ? "Đang thoát..." : "Đăng xuất"}
              {:else}
                {authBusy ? "Đang chuyển..." : "Đăng nhập"}
              {/if}
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-2 sm:flex-row sm:items-center xl:flex-nowrap xl:min-w-[34rem]">
          <input
            id="join_code"
            class="field h-11 min-w-0 flex-1 text-sm uppercase tracking-[.2em] text-center xl:max-w-[10rem]"
            type="text"
            placeholder="ABC123"
            maxlength="6"
            value={joinCode}
            on:input={onJoinCodeInput}
            disabled={pairBusy || authBusy}
            aria-label="Mã ghép cặp 6 ký tự"
          />
          <button class="btn btn-soft text-sm w-full sm:w-auto whitespace-nowrap" type="button" on:click={onJoinRoom} disabled={pairBusy || authBusy || !me}>
            {pairBusy ? "Đang xử lý..." : "Tham gia"}
          </button>
          <button class="btn btn-primary text-sm w-full sm:w-auto whitespace-nowrap" type="button" on:click={onCreateRoom} disabled={pairBusy || authBusy || !me}>
            {pairBusy ? "Đang tạo..." : "Tạo mã"}
          </button>
          <button class="btn btn-soft text-sm w-full sm:w-auto whitespace-nowrap" type="button" on:click={onToggleDetails}>
            {detailsExpanded ? "Thu gọn" : "Xem thêm"}
          </button>
        </div>
      </div>

      <div class="mt-2 flex flex-wrap gap-2">
        {#if room}
          <button class="btn btn-soft text-sm" type="button" on:click={onCopyLink} disabled={pairBusy || authBusy}>Copy link phòng</button>
          {#if needsConnect}
            <button class="btn btn-soft text-sm" type="button" on:click={onReconnect} disabled={pairBusy || authBusy}>Kết nối lại</button>
          {/if}
        {/if}
        {#if !hasStartDate}
          <button class="btn btn-soft text-sm" type="button" on:click={onOpenWizard}>Wizard</button>
        {/if}
      </div>

      {#if detailsExpanded}
        <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="rounded-xl border border-white/70 bg-white/70 p-3">
            <p class="text-xs font-semibold uppercase tracking-[.12em] text-pink-500/80">Tài khoản</p>
            {#if me}
              <div class="mt-2 flex items-center gap-2">
                <div class="h-9 w-9 rounded-lg bg-white border border-white/80 flex items-center justify-center text-base shrink-0">
                  {providerIcon(me.provider)}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-[color:var(--ink)] truncate">{displayAccountName}</p>
                  <p class="text-xs text-[color:var(--ink2)]">{providerName(me.provider)}</p>
                </div>
              </div>
              <div class="mt-2 flex flex-wrap gap-2">
                <button class="btn btn-soft text-sm" type="button" on:click={onOpenCredential} disabled={authBusy || pairBusy}>Đổi tài khoản</button>
                <button class="btn btn-soft text-sm" type="button" on:click={onOpenProfile} disabled={authBusy || pairBusy}>Cập nhật hồ sơ</button>
              </div>
            {:else}
              <p class="mt-2 text-sm text-[color:var(--ink2)]">Chưa đăng nhập.</p>
            {/if}
          </div>

          <div class="rounded-xl border border-white/70 bg-white/70 p-3">
            <p class="text-xs font-semibold uppercase tracking-[.12em] text-pink-500/80">Phòng chung</p>
            {#if room}
              <p class="mt-2 text-sm text-[color:var(--ink2)]">
                Chủ phòng: <span class="font-semibold text-[color:var(--ink)]">{room.owner?.username ? `@${room.owner.username}` : "—"}</span>
              </p>
              <p class="mt-1 text-sm text-[color:var(--ink2)]">
                Người còn lại:
                <span class="font-semibold text-[color:var(--ink)]">{room.partner?.username ? `@${room.partner.username}` : "Chưa tham gia"}</span>
              </p>
            {:else}
              <p class="mt-2 text-sm text-[color:var(--ink2)]">Tạo mã hoặc nhập mã để vào phòng.</p>
            {/if}
          </div>
        </div>
      {/if}

      {#if room && room.status !== "paired"}
        <p class="mt-2 text-xs text-[color:var(--ink2)]">
          Gửi mã <strong>{room.code}</strong> hoặc link phòng cho người kia.
        </p>
      {/if}

      {#if infoText}
        <p class="mt-3 rounded-xl border border-sky-200/70 bg-sky-50/80 px-3 py-2 text-sm text-sky-700">{infoText}</p>
      {/if}
      {#if errorText}
        <p class="mt-3 rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600">{errorText}</p>
      {/if}
    </div>
  {:else}
    <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-white/70 bg-white/65 p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Tài khoản</p>
            <p class="mt-1 text-sm text-[color:var(--ink2)]">
              {#if loading}
                Đang kiểm tra phiên đăng nhập...
              {:else if me}
                {displayAccountName}
              {:else}
                Chưa đăng nhập
              {/if}
            </p>
          </div>
          {#if me}
            <div class="h-10 w-10 rounded-xl bg-white/90 border border-white/90 flex items-center justify-center text-lg shrink-0">
              {providerIcon(me.provider)}
            </div>
          {/if}
        </div>

        {#if me}
          <div class="mt-3 flex flex-wrap gap-2 text-xs">
            <span class="pill">{providerName(me.provider)}</span>
            <span class="pill">{syncStatusLabel()}</span>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <button class="btn btn-soft text-sm" type="button" on:click={onOpenCredential} disabled={authBusy || pairBusy}>Đổi tài khoản</button>
            <button class="btn btn-soft text-sm" type="button" on:click={onOpenProfile} disabled={authBusy || pairBusy}>Cập nhật hồ sơ</button>
            <button class="btn btn-soft text-sm" type="button" on:click={onLogout} disabled={authBusy || pairBusy}>
              {authBusy ? "Đang thoát..." : "Đăng xuất"}
            </button>
          </div>
        {:else}
          <div class="mt-3 space-y-2">
            {#if !authConfigured}
              <p class="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                Tính năng đăng nhập hiện chưa sẵn sàng.
              </p>
            {/if}
            {#if canUsePasswordLogin}
              <button class="btn btn-primary text-sm w-full sm:w-auto" type="button" on:click={onOpenCredential}>Đăng nhập</button>
            {/if}
          </div>
        {/if}
      </div>

      <div class="rounded-2xl border border-white/70 bg-white/65 p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[.16em] text-pink-500/80">Phòng chung</p>
            <p class="mt-1 text-sm text-[color:var(--ink2)]">
              {#if room}
                Mã: <span class="font-bold text-[color:var(--ink)]">{room.code}</span>
                ({room.status === "paired" ? "đã đủ 2 người" : "đang chờ người kia"})
              {:else}
                Tạo mã mới hoặc nhập mã để tham gia.
              {/if}
            </p>
          </div>
          {#if room}
            <span class="pill">{room.status === "paired" ? "Đã ghép cặp" : "Chờ ghép cặp"}</span>
          {/if}
        </div>

        <div class="mt-4">
          <label for="join_code_standard" class="label">Mã ghép cặp (6 ký tự)</label>
          <input
            id="join_code_standard"
            class="field mt-1 text-sm uppercase tracking-[.2em] text-center"
            type="text"
            placeholder="ABC123"
            maxlength="6"
            value={joinCode}
            on:input={onJoinCodeInput}
            disabled={pairBusy || authBusy}
          />
        </div>

        <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button class="btn btn-soft text-sm w-full" type="button" on:click={onJoinRoom} disabled={pairBusy || authBusy || !me}>
            {pairBusy ? "Đang xử lý..." : "Tham gia bằng mã"}
          </button>
          <button class="btn btn-primary text-sm w-full" type="button" on:click={onCreateRoom} disabled={pairBusy || authBusy || !me}>
            {pairBusy ? "Đang tạo..." : "Tạo mã mới"}
          </button>
        </div>

        {#if room}
          <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div class="rounded-xl border border-white/70 bg-white/70 px-3 py-2.5">
              <p class="text-[11px] uppercase tracking-[.12em] text-[color:var(--ink2)]">Chủ phòng</p>
              <p class="mt-1 text-sm font-semibold text-[color:var(--ink)] truncate">{room.owner?.username ? `@${room.owner.username}` : "—"}</p>
            </div>
            <div class="rounded-xl border border-white/70 bg-white/70 px-3 py-2.5">
              <p class="text-[11px] uppercase tracking-[.12em] text-[color:var(--ink2)]">Người còn lại</p>
              <p class="mt-1 text-sm font-semibold text-[color:var(--ink)] truncate">{room.partner?.username ? `@${room.partner.username}` : "Chưa tham gia"}</p>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
            <button class="btn btn-soft text-sm" type="button" on:click={onCopyLink} disabled={pairBusy || authBusy}>Copy link phòng</button>
            {#if needsConnect}
              <button class="btn btn-soft text-sm" type="button" on:click={onReconnect} disabled={pairBusy || authBusy}>Kết nối lại</button>
            {/if}
            {#if !hasStartDate}
              <button class="btn btn-soft text-sm" type="button" on:click={onOpenWizard}>Wizard</button>
            {/if}
          </div>
        {/if}

        {#if room && room.status !== "paired"}
          <p class="mt-2 text-xs text-[color:var(--ink2)]">
            Gửi mã <strong>{room.code}</strong> hoặc link phòng cho người kia.
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
    {/if}
  {/if}
</section>
