# Lingo (Svelte Native Mobile)

Ứng dụng được xây bằng **Svelte + Vite** và đóng gói native bằng **Capacitor** cho:
- Android
- iOS

## Cài đặt

```bash
npm install
```

## Build và sync native

```bash
npm run mobile:sync
```

Lệnh trên sẽ:
1. Build web vào `dist`
2. Generate icon/splash native từ `resources/logo.svg`
3. Sync vào dự án Android/iOS

## Mở dự án native

Android:

```bash
npm run mobile:open:android
```

iOS (chỉ macOS):

```bash
npm run mobile:open:ios
```

## Build file phát hành

Android AAB:

```bash
npm run mobile:build:android:aab
```

iOS archive:
- Thực hiện trong Xcode theo checklist bên dưới.

iOS Ad Hoc `.ipa` (macOS + Xcode):

```bash
npm run mobile:build:ios:ipa:adhoc
```

Output:
- `ios/build/adhoc/App.ipa`

## Scripts

- `npm run dev`: chạy web local
- `npm run build`: build web
- `npm run assets:generate`: generate icon/splash native
- `npm run mobile:sync`: build + generate assets + sync native
- `npm run mobile:add:android`: thêm Android platform
- `npm run mobile:add:ios`: thêm iOS platform
- `npm run mobile:open:android`: mở Android Studio project
- `npm run mobile:open:ios`: mở Xcode project
- `npm run mobile:build:android:aab`: build AAB release
- `npm run mobile:build:ios:archive`: build iOS archive (`.xcarchive`)
- `npm run mobile:build:ios:ipa:adhoc`: export `.ipa` kiểu Ad Hoc

## Ký app và phát hành

Xem checklist đầy đủ:

- `docs/mobile-release-checklist.md`
- `docs/ios-adhoc-guide.md`

## Supabase

Đảm bảo `.env.local` có:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Và đã chạy schema:
- `supabase/lingo_schema.sql`
