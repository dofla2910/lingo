import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
const PROVIDERS_RAW = String(import.meta.env.VITE_SUPABASE_PROVIDERS || "facebook,google,github").trim();

const DEFAULT_PROVIDER_LABELS = {
  facebook: "Facebook",
  google: "Google",
  github: "GitHub",
  instagram: "Instagram",
  discord: "Discord",
  apple: "Apple",
  twitter: "X / Twitter",
  linkedin_oidc: "LinkedIn",
};

let supabaseSingleton = null;

function parseProviderList(raw) {
  return String(raw || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map((id) => ({ id, name: DEFAULT_PROVIDER_LABELS[id] || id }));
}

export function getSupabaseConfigError() {
  if (!SUPABASE_URL) return "Thiếu VITE_SUPABASE_URL.";
  if (!SUPABASE_ANON_KEY) return "Thiếu VITE_SUPABASE_ANON_KEY.";
  return "";
}

export function isSupabaseConfigured() {
  return !getSupabaseConfigError();
}

export function getEnabledAuthProviders() {
  return parseProviderList(PROVIDERS_RAW);
}

export function getSupabaseClient() {
  const err = getSupabaseConfigError();
  if (err) throw new Error(err);
  if (supabaseSingleton) return supabaseSingleton;

  supabaseSingleton = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return supabaseSingleton;
}

export function sanitizeRoomCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function authUserDisplayName(user) {
  const meta = user?.user_metadata || {};
  const email = typeof user?.email === "string" ? user.email : "";
  const emailName = email.includes("@") ? email.split("@")[0] : email;
  const raw =
    meta.user_name ||
    meta.preferred_username ||
    meta.username ||
    meta.full_name ||
    meta.name ||
    user?.phone ||
    emailName ||
    "user";
  return String(raw || "user").trim().replace(/^@+/, "");
}

function authUserAvatar(user) {
  const meta = user?.user_metadata || {};
  return (
    meta.avatar_url ||
    meta.picture ||
    meta.image ||
    meta.profile_image_url ||
    meta.profile_photo ||
    null
  );
}

export function toSafeAuthUser(user) {
  if (!user) return null;
  const provider =
    user?.app_metadata?.provider ||
    user?.user_metadata?.provider ||
    user?.identities?.[0]?.provider ||
    "supabase";
  return {
    id: String(user.id || ""),
    username: authUserDisplayName(user),
    provider: String(provider || "supabase"),
    avatarUrl: authUserAvatar(user),
    loginAt: user?.last_sign_in_at || null,
  };
}

export async function getCurrentAuthUser(client = getSupabaseClient()) {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return toSafeAuthUser(data?.user || null);
}

export async function signInWithProvider(providerId, { redirectTo } = {}, client = getSupabaseClient()) {
  const provider = String(providerId || "").trim().toLowerCase();
  if (!provider) throw new Error("Thiếu provider đăng nhập.");

  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
    },
  });
  if (error) throw error;
  return data;
}

export async function signOutAuth(client = getSupabaseClient()) {
  const { error } = await client.auth.signOut();
  if (error) throw error;
  return true;
}

function firstRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

export function isNoRowsError(error) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "").toLowerCase();
  return code === "PGRST116" || msg.includes("0 rows");
}

export function isSchemaMissingError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return (
    msg.includes("does not exist") &&
    (msg.includes("lingo_") || msg.includes("function") || msg.includes("relation"))
  );
}

export function mapRoomRowToDto(row, viewerUserId = "") {
  if (!row) return null;
  const ownerId = String(row.owner_user_id || "");
  const partnerId = String(row.partner_user_id || "");
  const code = sanitizeRoomCode(row.code || "");
  const room = {
    id: row.id || null,
    code,
    roomId: code,
    roomUuid: row.id || null,
    status: partnerId ? "paired" : String(row.status || "waiting"),
    createdAt: row.created_at || null,
    expiresAt: row.expires_at || null,
    owner: ownerId
      ? {
          id: ownerId,
          username: String(row.owner_username || "owner"),
          provider: row.owner_provider || null,
          avatarUrl: row.owner_avatar_url || null,
        }
      : null,
    partner: partnerId
      ? {
          id: partnerId,
          username: String(row.partner_username || "partner"),
          provider: row.partner_provider || null,
          avatarUrl: row.partner_avatar_url || null,
        }
      : null,
    isOwner: !!viewerUserId && viewerUserId === ownerId,
    isPartner: !!viewerUserId && viewerUserId === partnerId,
  };
  return room;
}

function rpcParamsForUser(prefix, user) {
  return {
    [`p_${prefix}_username`]: String(user?.username || "user"),
    [`p_${prefix}_provider`]: String(user?.provider || "supabase"),
    [`p_${prefix}_avatar_url`]: user?.avatarUrl || null,
  };
}

export async function getMyPairRoom(client = getSupabaseClient()) {
  const { data, error } = await client.rpc("lingo_my_room");
  if (error) throw error;
  return firstRow(data);
}

export async function getMemberRoomByCode(code, client = getSupabaseClient()) {
  const clean = sanitizeRoomCode(code);
  if (!clean) return null;
  const { data, error } = await client
    .from("lingo_rooms")
    .select("*")
    .eq("code", clean)
    .maybeSingle();
  if (error && !isNoRowsError(error)) throw error;
  return data || null;
}

export async function createPairRoom(user, client = getSupabaseClient()) {
  const { data, error } = await client.rpc("lingo_create_room", rpcParamsForUser("owner", user));
  if (error) throw error;
  return firstRow(data);
}

export async function joinPairRoom(code, user, client = getSupabaseClient()) {
  const clean = sanitizeRoomCode(code);
  const { data, error } = await client.rpc("lingo_join_room", {
    p_code: clean,
    ...rpcParamsForUser("partner", user),
  });
  if (error) throw error;
  return firstRow(data);
}

