export const APP_VERSION = 1;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

export function uid(prefix = "id") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultPerson(id = "a") {
  return {
    id,
    name: "",
    birthday: "",
    gender: "khong_tiet_lo",
    avatarType: "default",
    avatarUrl: "",
    avatarSourceUrl: "",
  };
}

export function createDefaultState() {
  return {
    version: APP_VERSION,
    settings: {
      startDate: "",
      timezoneMode: "local",
    },
    couple: {
      personA: createDefaultPerson("a"),
      personB: createDefaultPerson("b"),
    },
    events: [],
    celebrations: {
      shownMilestoneIds: [],
    },
    ui: {
      authPanelMode: "ultra_minimal", // ultra_minimal | standard
    },
  };
}

export function normalizePerson(raw, fallbackId = "a") {
  const src = asObject(raw);
  return {
    id: asString(src.id, fallbackId),
    name: asString(src.name, ""),
    birthday: asString(src.birthday, ""),
    gender: ["nam", "nu", "khac", "khong_tiet_lo"].includes(src.gender) ? src.gender : "khong_tiet_lo",
    avatarType: ["default", "url", "upload"].includes(src.avatarType) ? src.avatarType : "default",
    avatarUrl: asString(src.avatarUrl, ""),
    avatarSourceUrl: asString(src.avatarSourceUrl, ""),
  };
}

export function normalizeEvent(raw) {
  const src = asObject(raw);
  const date = asString(src.date, "").trim();
  if (!date) return null;
  const id = asString(src.id, uid("evt"));
  const ts = nowIso();
  return {
    id,
    title: asString(src.title, "Sự kiện"),
    category: ["sinh_nhat", "ky_niem", "hen_ho", "khac"].includes(src.category) ? src.category : "khac",
    date,
    repeatAnnual: !!src.repeatAnnual,
    note: asString(src.note, ""),
    createdAt: asString(src.createdAt, ts),
    updatedAt: asString(src.updatedAt, ts),
  };
}

export function migrateState(rawInput) {
  const raw = asObject(rawInput);
  const base = createDefaultState();
  const settings = asObject(raw.settings);
  const couple = asObject(raw.couple);
  const celebrations = asObject(raw.celebrations);
  const ui = asObject(raw.ui);
  const authPanelMode = ["ultra_minimal", "standard"].includes(ui.authPanelMode)
    ? ui.authPanelMode
    : "ultra_minimal";

  return {
    ...raw,
    version: APP_VERSION,
    settings: {
      ...base.settings,
      ...settings,
      startDate: asString(settings.startDate, ""),
      timezoneMode: asString(settings.timezoneMode, "local") || "local",
    },
    couple: {
      ...base.couple,
      ...couple,
      personA: normalizePerson(couple.personA, "a"),
      personB: normalizePerson(couple.personB, "b"),
    },
    events: Array.isArray(raw.events) ? raw.events.map(normalizeEvent).filter(Boolean) : [],
    celebrations: {
      shownMilestoneIds: Array.isArray(celebrations.shownMilestoneIds)
        ? celebrations.shownMilestoneIds.filter((v) => typeof v === "string")
        : [],
    },
    ui: {
      ...ui,
      authPanelMode,
    },
  };
}
