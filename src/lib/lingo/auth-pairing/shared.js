export const SHOW_PROVIDER_LOGIN = false;

export const INITIAL_STATE = {
  loading: true,
  authBusy: false,
  pairBusy: false,
  me: null,
  room: null,
  providers: [],
  authConfigured: false,
  joinCode: "",
  errorText: "",
  infoText: "",
  providerPickerOpen: false,
  providerPickerReason: "",
  pendingAutoPairAfterAuth: false,
  autoPairRequestedFromQuery: false,
  detailsExpanded: false,
  credentialModalOpen: false,
  credentialMode: "signin",
  loginUsername: "",
  loginPassword: "",
  loginPasswordConfirm: "",
  pendingJoinCodeAfterAuth: "",
  myProfile: null,
  profileModalOpen: false,
  profileBusy: false,
  profilePromptedForUserId: "",
  profileDraft: {
    name: "",
    birthday: "",
    gender: "khong_tiet_lo",
    avatarUrlInput: "",
    uploadedAvatarData: "",
    useDefault: true,
    existingAvatarUrl: "",
  },
};

export function providerIcon(id) {
  const k = String(id || "").toLowerCase();
  if (k === "email" || k === "supabase") return "👤";
  if (k === "instagram") return "📸";
  if (k === "facebook") return "📘";
  if (k === "google") return "🔎";
  if (k === "github") return "🐙";
  if (k === "discord") return "🎮";
  if (k === "apple") return "🍎";
  return "🔐";
}

export function providerName(id, fallback = "") {
  const k = String(id || "").toLowerCase();
  if (fallback) return fallback;
  if (k === "email" || k === "supabase") return "Tài khoản";
  if (k === "instagram") return "Instagram";
  if (k === "facebook") return "Facebook";
  if (k === "google") return "Google";
  if (k === "github") return "GitHub";
  if (k === "discord") return "Discord";
  if (k === "apple") return "Apple";
  return id || "OAuth";
}

export function providerHint(id) {
  const k = String(id || "").toLowerCase();
  if (k === "instagram") return "Phù hợp nếu cả hai thường dùng Instagram. Có thể cần bật sẵn trong phần cài đặt đăng nhập.";
  if (k === "facebook") return "Dễ dùng cho đa số người dùng, thuận tiện chia sẻ mã ghép cặp.";
  if (k === "google") return "Đăng nhập nhanh, thường ổn định với callback URL.";
  if (k === "github") return "Tiện cho tài khoản kỹ thuật / dev.";
  if (k === "discord") return "Nhanh cho cặp đôi dùng Discord.";
  if (k === "apple") return "Phù hợp hệ sinh thái Apple, cần cấu hình provider trước.";
  return "Đăng nhập để tạo hoặc tham gia phòng cặp đôi.";
}

export function providerAccent(id) {
  const k = String(id || "").toLowerCase();
  if (k === "instagram") return "from-pink-400/25 to-orange-300/25";
  if (k === "facebook") return "from-blue-400/25 to-sky-300/25";
  if (k === "google") return "from-emerald-300/20 to-rose-300/20";
  if (k === "github") return "from-slate-400/20 to-zinc-300/20";
  if (k === "discord") return "from-indigo-400/25 to-violet-300/25";
  if (k === "apple") return "from-zinc-300/20 to-slate-300/20";
  return "from-pink-300/20 to-rose-200/20";
}

export function normalizeCode(value, sanitizeRoomCode) {
  return sanitizeRoomCode(value);
}

export function toErrorMessage(err, isSchemaMissingError, fallback = "Không thể thực hiện thao tác.") {
  const msg = String(err?.message || err || fallback);
  const lower = msg.toLowerCase();

  if (isSchemaMissingError?.(err)) return "Ứng dụng chưa sẵn sàng dữ liệu. Vui lòng thử lại sau.";
  if (msg.includes("UNAUTHENTICATED")) return "Vui lòng đăng nhập trước.";
  if (msg.includes("INVALID_CODE")) return "Mã ghép cặp không hợp lệ (cần đúng 6 ký tự).";
  if (msg.includes("CODE_NOT_FOUND_OR_EXPIRED")) return "Mã không tồn tại hoặc đã hết hạn.";
  if (msg.includes("ROOM_ALREADY_HAS_2_PEOPLE")) return "Phòng này đã đủ 2 người.";
  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return "Không thể truy cập dữ liệu phòng. Hãy đăng nhập lại hoặc thử lại sau.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) return "Không thể kết nối dữ liệu. Hãy kiểm tra mạng.";
  if (lower.includes("supabase chưa cấu hình") || lower.includes("vite_supabase_")) return msg;
  return msg || fallback;
}
