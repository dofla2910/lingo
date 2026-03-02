export function formatPingClock(value) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function buildPingMessage(ping) {
  const senderName = String(ping?.senderName || "").trim() || "Ng\u01b0\u1eddi \u1ea5y";
  const missedCount = Number(ping?.missedCount || 0);

  if (missedCount > 1) {
    return `B\u1ea1n c\u00f3 ${missedCount} N\u00fat ch\u1ea1m m\u1edbi t\u1eeb ${senderName}.`;
  }
  return `${senderName} v\u1eeba nh\u1edb b\u1ea1n l\u00fac ${formatPingClock(ping?.createdAt)}`;
}

export function resolveMissedCount(ping) {
  return Math.max(1, Number(ping?.missedCount || 0));
}
