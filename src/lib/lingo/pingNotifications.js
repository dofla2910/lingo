function isHiddenDocument() {
  if (typeof document === "undefined") return false;
  return document.visibilityState === "hidden";
}

function canUseWebNotification() {
  return typeof window !== "undefined" && "Notification" in window;
}

async function showWebNotification(title, body) {
  if (!canUseWebNotification()) return false;

  let permission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch (_err) {
      permission = "denied";
    }
  }
  if (permission !== "granted") return false;

  try {
    const note = new Notification(title, {
      body,
      icon: "/logos/lingo-icon.svg",
      badge: "/logos/lingo-icon.svg",
      tag: "lingo-ping",
      renotify: true,
      silent: false,
    });
    note.onclick = () => {
      try {
        window.focus();
      } catch (_err) {
        // noop
      }
      note.close();
    };
    return true;
  } catch (_err) {
    return false;
  }
}

async function showCapacitorLocalNotification(title, body) {
  if (typeof window === "undefined") return false;
  const cap = window.Capacitor;
  const isNative = typeof cap?.isNativePlatform === "function" ? cap.isNativePlatform() : false;
  if (!isNative) return false;

  const plugin = cap?.Plugins?.LocalNotifications;
  if (!plugin?.requestPermissions || !plugin?.schedule) return false;

  try {
    const permissions = await plugin.requestPermissions();
    const displayPermission = String(
      permissions?.display || permissions?.receive || permissions?.notifications || "",
    ).toLowerCase();
    if (displayPermission !== "granted") return false;

    const nextId = Math.floor(Date.now() % 2147480000);
    await plugin.schedule({
      notifications: [
        {
          id: nextId,
          title,
          body,
          schedule: { at: new Date(Date.now() + 120) },
        },
      ],
    });
    return true;
  } catch (_err) {
    return false;
  }
}

export async function showPingNotification(title, body) {
  if (!isHiddenDocument()) return false;
  if (await showWebNotification(title, body)) return true;
  return showCapacitorLocalNotification(title, body);
}
