import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import webpush from "npm:web-push@3.6.7";

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  enabled: boolean;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function getEnv(name: string): string {
  return String(Deno.env.get(name) || "").trim();
}

function formatPingClock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function asSafeString(value: unknown, fallback = "") {
  const v = String(value ?? "").trim();
  return v || fallback;
}

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY = getEnv("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const WEB_PUSH_VAPID_PUBLIC_KEY = getEnv("WEB_PUSH_VAPID_PUBLIC_KEY");
const WEB_PUSH_VAPID_PRIVATE_KEY = getEnv("WEB_PUSH_VAPID_PRIVATE_KEY");
const WEB_PUSH_VAPID_SUBJECT = getEnv("WEB_PUSH_VAPID_SUBJECT") || "mailto:noreply@lingo.local";

const isConfigured = Boolean(
  SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    SUPABASE_SERVICE_ROLE_KEY &&
    WEB_PUSH_VAPID_PUBLIC_KEY &&
    WEB_PUSH_VAPID_PRIVATE_KEY,
);

if (isConfigured) {
  webpush.setVapidDetails(
    WEB_PUSH_VAPID_SUBJECT,
    WEB_PUSH_VAPID_PUBLIC_KEY,
    WEB_PUSH_VAPID_PRIVATE_KEY,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  if (!isConfigured) {
    return jsonResponse(
      {
        ok: false,
        error: "MISSING_ENV",
        details:
          "Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY / WEB_PUSH_VAPID_PUBLIC_KEY / WEB_PUSH_VAPID_PRIVATE_KEY",
      },
      500,
    );
  }

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user?.id) return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) || {};
  } catch (_err) {
    body = {};
  }

  const roomId = asSafeString(body.roomId);
  if (!roomId) return jsonResponse({ ok: false, error: "ROOM_ID_REQUIRED" }, 400);

  const { data: room, error: roomErr } = await admin
    .from("lingo_rooms")
    .select("id,code,owner_user_id,partner_user_id,owner_username,partner_username")
    .eq("id", roomId)
    .maybeSingle();
  if (roomErr || !room) return jsonResponse({ ok: false, error: "ROOM_NOT_FOUND" }, 404);

  const ownerId = asSafeString(room.owner_user_id);
  const partnerId = asSafeString(room.partner_user_id);
  const isOwner = user.id === ownerId;
  const isPartner = user.id === partnerId;
  if (!isOwner && !isPartner) return jsonResponse({ ok: false, error: "FORBIDDEN" }, 403);

  const targetUserId = isOwner ? partnerId : ownerId;
  if (!targetUserId) return jsonResponse({ ok: true, sent: 0, skipped: "NO_PARTNER" }, 202);

  const senderName = asSafeString(
    body.senderName,
    isOwner ? asSafeString(room.owner_username, "Nguoi ay") : asSafeString(room.partner_username, "Nguoi ay"),
  ).slice(0, 80);
  const createdAt = asSafeString(body.createdAt, new Date().toISOString());
  const pingId = asSafeString(body.pingId);
  const roomCode = asSafeString(body.roomCode, asSafeString(room.code));
  const targetUrl = roomCode ? `/?room=${encodeURIComponent(roomCode)}` : "/";

  const { data: subscriptions, error: subErr } = await admin
    .from("lingo_push_subscriptions")
    .select("id,endpoint,p256dh,auth,enabled")
    .eq("room_id", roomId)
    .eq("user_id", targetUserId)
    .eq("enabled", true);
  if (subErr) return jsonResponse({ ok: false, error: "SUBSCRIPTION_QUERY_FAILED" }, 500);

  const list = Array.isArray(subscriptions) ? (subscriptions as PushSubscriptionRow[]) : [];
  if (!list.length) {
    return jsonResponse({ ok: true, sent: 0, skipped: "NO_ACTIVE_SUBSCRIPTION" });
  }

  const payload = JSON.stringify({
    title: "Lingo • Nút chạm",
    body: `${senderName} vừa nhớ bạn lúc ${formatPingClock(createdAt)}`,
    url: targetUrl,
    pingId,
    roomId,
    senderId: user.id,
    createdAt,
    tag: "lingo-ping",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
  });

  let sent = 0;
  let removed = 0;

  for (const sub of list) {
    const endpoint = asSafeString(sub.endpoint);
    const p256dh = asSafeString(sub.p256dh);
    const auth = asSafeString(sub.auth);
    if (!endpoint || !p256dh || !auth) continue;

    try {
      await webpush.sendNotification(
        {
          endpoint,
          expirationTime: null,
          keys: { p256dh, auth },
        },
        payload,
        {
          TTL: 60,
          urgency: "high",
        },
      );
      sent += 1;
    } catch (err) {
      const statusCode = Number((err as { statusCode?: number; status?: number })?.statusCode || (err as { status?: number })?.status || 0);
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("lingo_push_subscriptions").delete().eq("id", sub.id);
        removed += 1;
      }
    }
  }

  return jsonResponse({
    ok: true,
    sent,
    removed,
    total: list.length,
  });
});
