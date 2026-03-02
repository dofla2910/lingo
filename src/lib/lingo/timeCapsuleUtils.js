export const MIN_UNLOCK_AHEAD_MS = 1000;

export function parseDateTimeSafe(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toLocalDateTimeInputValue(value) {
  const date = parseDateTimeSafe(value) || new Date(Date.now() + 24 * 60 * 60 * 1000);
  const localMs = date.getTime() - date.getTimezoneOffset() * 60 * 1000;
  return new Date(localMs).toISOString().slice(0, 16);
}

export function formatDateTime(value) {
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

export function pad2(value) {
  return String(Math.max(0, Number(value) || 0)).padStart(2, "0");
}

export function remainingMs(unlockAt, currentNow = Date.now()) {
  const date = parseDateTimeSafe(unlockAt);
  if (!date) return 0;
  return Math.max(0, date.getTime() - currentNow);
}

export function countdownParts(unlockAt, currentNow = Date.now()) {
  const ms = remainingMs(unlockAt, currentNow);
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, expired: totalSeconds <= 0 };
}

export function countdownLabel(unlockAt, currentNow = Date.now()) {
  const part = countdownParts(unlockAt, currentNow);
  if (part.expired) return "Đã đến giờ mở";
  return `${pad2(part.days)} : ${pad2(part.hours)} : ${pad2(part.minutes)} : ${pad2(part.seconds)}`;
}

export function isUnlocked(item, currentNow = Date.now()) {
  const date = parseDateTimeSafe(item?.unlock_at);
  if (!date) return false;
  return currentNow >= date.getTime();
}

export function sortCapsules(list) {
  return [...(Array.isArray(list) ? list : [])].sort((a, b) => {
    const aUnlock = parseDateTimeSafe(a.unlock_at)?.getTime() || 0;
    const bUnlock = parseDateTimeSafe(b.unlock_at)?.getTime() || 0;
    if (aUnlock !== bUnlock) return aUnlock - bUnlock;
    const aCreated = parseDateTimeSafe(a.created_at)?.getTime() || 0;
    const bCreated = parseDateTimeSafe(b.created_at)?.getTime() || 0;
    return bCreated - aCreated;
  });
}

export function guessExtFromMime(type) {
  const mime = String(type || "").toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}
