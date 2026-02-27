export const GENDER_LABELS = {
  nam: "Nam",
  nu: "Nữ",
  khac: "Khác",
  khong_tiet_lo: "Không tiết lộ",
};

export const EVENT_CATEGORY_LABELS = {
  sinh_nhat: "Sinh nhật",
  ky_niem: "Kỷ niệm",
  hen_ho: "Hẹn hò",
  khac: "Khác",
};

export const ELEMENT_META = {
  Fire: { label: "Lửa", color: "var(--fire)", bg: "rgba(239,71,111,.14)" },
  Earth: { label: "Đất", color: "var(--earth)", bg: "rgba(127,85,57,.12)" },
  Air: { label: "Khí", color: "var(--air)", bg: "rgba(123,223,242,.2)" },
  Water: { label: "Nước", color: "var(--water)", bg: "rgba(58,134,255,.12)" },
};

export const MILESTONE_DEFS = [
  { id: "m_1_week", label: "1 tuần", type: "days", amount: 7 },
  { id: "m_1_month", label: "1 tháng", type: "months", amount: 1 },
  { id: "m_100_days", label: "100 ngày", type: "days", amount: 100 },
  { id: "m_1_year", label: "1 năm", type: "years", amount: 1 },
  { id: "m_500_days", label: "500 ngày", type: "days", amount: 500 },
  { id: "m_2_years", label: "2 năm", type: "years", amount: 2 },
  { id: "m_1000_days", label: "1000 ngày", type: "days", amount: 1000 },
  { id: "m_5_years", label: "5 năm", type: "years", amount: 5 },
  { id: "m_7_years", label: "7 năm", type: "years", amount: 7 },
  { id: "m_10_years", label: "10 năm", type: "years", amount: 10 },
];

export function pad2(n) {
  return String(Number.isFinite(n) ? Math.max(0, n) : 0).padStart(2, "0");
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function parseDate(value) {
  if (!value || typeof value !== "string") return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = +m[1];
  const month = +m[2] - 1;
  const d = +m[3];
  const dt = new Date(y, month, d, 0, 0, 0, 0);
  return dt.getFullYear() === y && dt.getMonth() === month && dt.getDate() === d ? dt : null;
}

export function parseDateTime(value) {
  if (!value || typeof value !== "string") return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) {
    const y = +m[1];
    const month = +m[2] - 1;
    const d = +m[3];
    const h = +m[4];
    const min = +m[5];
    const sec = +(m[6] || 0);
    const dt = new Date(y, month, d, h, min, sec, 0);
    if (dt.getFullYear() === y && dt.getMonth() === month && dt.getDate() === d) return dt;
    return null;
  }
  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function isValidDate(dt) {
  return dt instanceof Date && !Number.isNaN(dt.getTime());
}

export function startOfDay(dt) {
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

export function sameDay(a, b) {
  return (
    isValidDate(a) &&
    isValidDate(b) &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

export function addDays(dt, n) {
  const x = new Date(dt);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(dt, n) {
  const x = new Date(dt);
  const day = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  x.setDate(Math.min(day, daysInMonth(x.getFullYear(), x.getMonth())));
  return x;
}

export function addYears(dt, n) {
  const x = new Date(dt);
  const month = x.getMonth();
  const day = x.getDate();
  x.setFullYear(x.getFullYear() + n, month, 1);
  x.setDate(Math.min(day, daysInMonth(x.getFullYear(), month)));
  return x;
}

/**
 * Tính chênh lệch kiểu lịch cho bộ đếm tình yêu.
 * Không đổi tháng/năm sang số ngày cố định vì số ngày mỗi tháng khác nhau.
 */
export function elapsedCalendar(start, end) {
  if (!isValidDate(start) || !isValidDate(end) || end < start) {
    return { valid: false, years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  let cur = new Date(start);
  let years = 0;
  while (years < 200) {
    const nx = addYears(cur, 1);
    if (nx <= end) {
      cur = nx;
      years += 1;
    } else break;
  }
  let months = 0;
  while (months < 24) {
    const nx = addMonths(cur, 1);
    if (nx <= end) {
      cur = nx;
      months += 1;
    } else break;
  }
  let days = 0;
  while (days < 40) {
    const nx = addDays(cur, 1);
    if (nx <= end) {
      cur = nx;
      days += 1;
    } else break;
  }
  let remainSec = Math.floor((end - cur) / 1000);
  const hours = Math.floor(remainSec / 3600);
  remainSec -= hours * 3600;
  const minutes = Math.floor(remainSec / 60);
  remainSec -= minutes * 60;
  const seconds = Math.max(0, remainSec);
  return { valid: true, years, months, days, hours, minutes, seconds };
}

export function formatDate(dt) {
  if (!isValidDate(dt)) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dt);
}

export function formatDateTime(dt) {
  if (!isValidDate(dt)) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

export function toDateInput(dt) {
  if (!isValidDate(dt)) return "";
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

export function toDateTimeInput(dt) {
  if (!isValidDate(dt)) return "";
  return `${toDateInput(dt)}T${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

export async function resizeAvatarFile(file, max = 320) {
  if (!(file instanceof File)) return null;
  if (!String(file.type || "").startsWith("image/")) {
    throw new Error("Vui lòng chọn tệp hình ảnh.");
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Không đọc được ảnh."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không tải được ảnh."));
    image.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  const ratio = Math.min(1, max / img.width, max / img.height);
  canvas.width = Math.max(1, Math.round(img.width * ratio));
  canvas.height = Math.max(1, Math.round(img.height * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Thiếu canvas context.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function calculateAge(birthday, today = new Date()) {
  if (!isValidDate(birthday)) return null;
  let age = today.getFullYear() - birthday.getFullYear();
  const hadBirthday =
    today.getMonth() > birthday.getMonth() ||
    (today.getMonth() === birthday.getMonth() && today.getDate() >= birthday.getDate());
  if (!hadBirthday) age -= 1;
  return age >= 0 ? age : null;
}

export function getWesternZodiac(birthday) {
  if (!isValidDate(birthday)) return null;
  const m = birthday.getMonth() + 1;
  const d = birthday.getDate();
  const inRange = (mo, a, b) => m === mo && d >= a && d <= b;
  if (inRange(3, 21, 31) || inRange(4, 1, 19)) return { name: "Bạch Dương", element: "Fire" };
  if (inRange(4, 20, 30) || inRange(5, 1, 20)) return { name: "Kim Ngưu", element: "Earth" };
  if (inRange(5, 21, 31) || inRange(6, 1, 20)) return { name: "Song Tử", element: "Air" };
  if (inRange(6, 21, 30) || inRange(7, 1, 22)) return { name: "Cự Giải", element: "Water" };
  if (inRange(7, 23, 31) || inRange(8, 1, 22)) return { name: "Sư Tử", element: "Fire" };
  if (inRange(8, 23, 31) || inRange(9, 1, 22)) return { name: "Xử Nữ", element: "Earth" };
  if (inRange(9, 23, 30) || inRange(10, 1, 22)) return { name: "Thiên Bình", element: "Air" };
  if (inRange(10, 23, 31) || inRange(11, 1, 21)) return { name: "Bọ Cạp", element: "Water" };
  if (inRange(11, 22, 30) || inRange(12, 1, 21)) return { name: "Nhân Mã", element: "Fire" };
  if (inRange(12, 22, 31) || inRange(1, 1, 19)) return { name: "Ma Kết", element: "Earth" };
  if (inRange(1, 20, 31) || inRange(2, 1, 18)) return { name: "Bảo Bình", element: "Air" };
  return { name: "Song Ngư", element: "Water" };
}

export function fallbackFlamingoAvatar(size = 120) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#FFD7EA"/><stop offset="100%" stop-color="#FF9CC8"/></linearGradient></defs>` +
    `<rect width="120" height="120" rx="24" fill="#FFF8FC"/>` +
    `<circle cx="60" cy="60" r="47" fill="url(#g)" opacity=".34"/>` +
    `<path d="M69 26c7 1 12 7 12 14 0 6-4 12-10 14l-3 1c-5 2-8 6-8 11v16c0 8-6 14-14 14s-14-6-14-14c0-7 5-13 12-14l6-1c3-1 5-3 5-6v-4c0-6 2-11 6-15l8-8z" fill="#FF8FB4"/>` +
    `<path d="M78 24c6 1 11 7 11 13 0 6-4 11-9 13l-5 2-5-7 4-4c2-2 3-4 3-7 0-4-2-7-5-9l6-1z" fill="#FF6F91"/>` +
    `<path d="M80 38l10-1-8 7" stroke="#8A4C5D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M55 86v13M64 86v13" stroke="#D46987" stroke-width="2.4" stroke-linecap="round"/>` +
    `<path d="M54 99h7M63 99h7" stroke="#8A4C5D" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M90 32c3 0 6 3 6 6 0 5-6 8-10 11-4-3-10-6-10-11 0-3 3-6 6-6 2 0 3 1 4 2 1-1 2-2 4-2z" fill="#FF5E8C" opacity=".9"/>` +
    `</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function resolveMilestoneDate(start, def) {
  if (!isValidDate(start)) return null;
  if (def.type === "days") return addDays(start, def.amount);
  if (def.type === "months") return addMonths(start, def.amount);
  if (def.type === "years") return addYears(start, def.amount);
  return null;
}

export function buildMilestoneView(start, now = new Date()) {
  if (!isValidDate(start)) {
    return { items: [], next: null, allDone: false };
  }
  const items = MILESTONE_DEFS.map((def) => {
    const date = resolveMilestoneDate(start, def);
    const achieved = !!date && now >= date;
    return { ...def, date, achieved };
  });
  const next = items.find((m) => m.date && now < m.date) || null;
  return { items, next, allDone: !next && items.length > 0 };
}

export function nextMilestoneProgress(start, nextMilestone, now = new Date()) {
  if (!isValidDate(start) || !nextMilestone?.date) return 0;
  const total = nextMilestone.date.getTime() - start.getTime();
  if (total <= 0) return 100;
  const done = now.getTime() - start.getTime();
  return clamp((done / total) * 100, 0, 100);
}

export function daysUntil(target, now = new Date()) {
  if (!isValidDate(target) || !isValidDate(now)) return null;
  const a = startOfDay(now);
  const b = startOfDay(target);
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

export function nextOccurrenceForEvent(event, today = new Date()) {
  if (!event || typeof event !== "object") return null;
  const base = parseDate(event.date);
  if (!base) return null;
  if (!event.repeatAnnual) return base;

  const y = today.getFullYear();
  const mo = base.getMonth();
  const d = base.getDate();
  const safeDayThisYear = Math.min(d, daysInMonth(y, mo)); // 29/02 -> 28/02 on non-leap years
  let candidate = new Date(y, mo, safeDayThisYear, 0, 0, 0, 0);
  if (startOfDay(candidate) < startOfDay(today)) {
    const y2 = y + 1;
    const safeDayNextYear = Math.min(d, daysInMonth(y2, mo));
    candidate = new Date(y2, mo, safeDayNextYear, 0, 0, 0, 0);
  }
  return candidate;
}

export function isTodayEvent(event, today = new Date()) {
  const occ = nextOccurrenceForEvent(event, today);
  return sameDay(occ, today);
}

export function sortEventsForDisplay(events, today = new Date()) {
  const list = Array.isArray(events) ? events.slice() : [];
  const todayStart = startOfDay(today).getTime();
  return list
    .map((event) => ({
      event,
      nextOccurrence: nextOccurrenceForEvent(event, today),
    }))
    .sort((a, b) => {
      const at = a.nextOccurrence ? a.nextOccurrence.getTime() : Number.POSITIVE_INFINITY;
      const bt = b.nextOccurrence ? b.nextOccurrence.getTime() : Number.POSITIVE_INFINITY;

      const aPast = at < todayStart;
      const bPast = bt < todayStart;
      if (aPast !== bPast) return aPast ? 1 : -1;

      if (aPast && bPast) {
        if (at !== bt) return bt - at; // Past events: nearest past first.
      } else if (at !== bt) {
        return at - bt; // Upcoming/today events: nearest future first.
      }

      return String(a.event.title || "").localeCompare(String(b.event.title || ""), "vi");
    });
}
