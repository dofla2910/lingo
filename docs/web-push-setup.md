# Web Push Setup (Supabase + PWA)

Use this flow to deliver `Nút chạm` notifications even when the app is closed.

## 1) Run SQL

Run these scripts in Supabase SQL Editor:

1. `supabase/lingo_schema.sql`
2. `supabase/lingo_pings.sql`
3. `supabase/lingo_web_push.sql`

## 2) Generate VAPID keys

```bash
npx web-push generate-vapid-keys
```

Copy `publicKey` and `privateKey`.

## 3) Frontend env (Vercel / local)

Set:

- `VITE_WEB_PUSH_PUBLIC_KEY=<your_public_key>`
- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

## 4) Supabase Edge Function secrets

```bash
supabase secrets set WEB_PUSH_VAPID_PUBLIC_KEY=<your_public_key>
supabase secrets set WEB_PUSH_VAPID_PRIVATE_KEY=<your_private_key>
supabase secrets set WEB_PUSH_VAPID_SUBJECT=mailto:you@example.com
```

## 5) Deploy Edge Function

```bash
supabase functions deploy send-ping-push
```

## 6) Test checklist

1. Open app on device A and B, login and join same room.
2. Accept notification permission on B.
3. Close app/tab on B.
4. Press `Nút chạm` on A.
5. B should receive a system push notification and open app on tap.
