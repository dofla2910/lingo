import { parseDate, resizeAvatarFile } from "../utils.js";
import { supabase } from "../supabaseClient.js";

export function createProfileSlice({
  getState,
  patch,
  fallbackAvatar,
  sanitizeUsername,
  upsertMyUserProfile,
  toErrorMessage,
  emitToast,
  onAfterProfileSaved,
}) {
  function profileFromRow(row, fallbackUser = null) {
    const fallbackName = sanitizeUsername(fallbackUser?.username || "") || "user";
    return {
      name: String(row?.name || fallbackName).trim(),
      birthday: String(row?.birthday || "").trim(),
      gender: ["nam", "nu", "khac", "khong_tiet_lo"].includes(row?.gender) ? row.gender : "khong_tiet_lo",
      avatarUrl: String(row?.avatarUrl || "").trim(),
    };
  }

  function hasValidProfile(profile = getState().myProfile) {
    return !!(profile?.name && profile?.birthday && parseDate(profile.birthday));
  }

  function hydrateProfileDraft(profile) {
    patch({
      profileDraft: {
        name: String(profile?.name || "").trim(),
        birthday: String(profile?.birthday || "").trim(),
        gender: ["nam", "nu", "khac", "khong_tiet_lo"].includes(profile?.gender) ? profile.gender : "khong_tiet_lo",
        avatarUrlInput: String(profile?.avatarUrl || "").trim(),
        uploadedAvatarData: "",
        useDefault: !String(profile?.avatarUrl || "").trim(),
        existingAvatarUrl: String(profile?.avatarUrl || "").trim(),
      },
    });
  }

  function openProfileModal(options = {}) {
    const state = getState();
    if (!state.me) return;
    if (!options.keepMessages) {
      patch({
        errorText: "",
        infoText: "",
      });
    }
    const base = state.myProfile || profileFromRow(null, state.me);
    hydrateProfileDraft(base);
    patch({
      profileModalOpen: true,
      ...(options.required ? { infoText: "Vui lòng hoàn tất hồ sơ trước khi tạo hoặc tham gia phòng." } : {}),
    });
  }

  function closeProfileModal() {
    if (getState().profileBusy) return;
    patch({ profileModalOpen: false });
  }

  function composeProfilePayload() {
    const state = getState();
    const name = String(state.profileDraft.name || "").trim();
    const birthday = String(state.profileDraft.birthday || "").trim();
    const gender = state.profileDraft.gender || "khong_tiet_lo";
    const avatarUrl = state.profileDraft.useDefault
      ? ""
      : String(state.profileDraft.uploadedAvatarData || state.profileDraft.avatarUrlInput || state.profileDraft.existingAvatarUrl || "").trim();

    if (!name) throw new Error("Vui lòng nhập tên hiển thị.");
    if (!birthday || !parseDate(birthday)) throw new Error("Ngày sinh không hợp lệ.");
    return { name, birthday, gender, avatarUrl };
  }

  async function onProfileAvatarFile(file) {
    if (!file) return;
    try {
      const data = await resizeAvatarFile(file, 320);
      patch((prev) => ({
        profileDraft: {
          ...prev.profileDraft,
          uploadedAvatarData: data || "",
          useDefault: false,
        },
      }));
    } catch (err) {
      patch({ errorText: err?.message || "Không thể xử lý ảnh." });
    }
  }

  function onProfileImageError(event) {
    if (event?.currentTarget) event.currentTarget.src = fallbackAvatar;
  }

  async function saveMyProfile() {
    const state = getState();
    if (!state.me || state.profileBusy) return;
    patch({ profileBusy: true, errorText: "" });

    try {
      const payload = composeProfilePayload();
      if (!supabase) throw new Error("Supabase chưa sẵn sàng.");
      const client = supabase;
      const row = await upsertMyUserProfile(payload, client);
      patch({
        myProfile: profileFromRow(row, getState().me),
        profileModalOpen: false,
      });
      emitToast("Đã lưu hồ sơ cá nhân.");
      await onAfterProfileSaved?.();
    } catch (err) {
      patch({ errorText: toErrorMessage(err, "Không thể lưu hồ sơ.") });
    } finally {
      patch({ profileBusy: false });
    }
  }

  function useDefaultAvatar() {
    patch((prev) => ({
      profileDraft: {
        ...prev.profileDraft,
        useDefault: true,
      },
    }));
  }

  function updateProfileDraft(field, value) {
    if (!field) return;
    patch((prev) => {
      if (field === "avatarUrlInput") {
        const nextValue = String(value || "");
        return {
          profileDraft: {
            ...prev.profileDraft,
            avatarUrlInput: nextValue,
            useDefault: nextValue.trim() ? false : prev.profileDraft.useDefault,
          },
        };
      }
      return {
        profileDraft: {
          ...prev.profileDraft,
          [field]: value,
        },
      };
    });
  }

  return {
    profileFromRow,
    hasValidProfile,
    openProfileModal,
    closeProfileModal,
    onProfileAvatarFile,
    onProfileImageError,
    saveMyProfile,
    useDefaultAvatar,
    updateProfileDraft,
  };
}
