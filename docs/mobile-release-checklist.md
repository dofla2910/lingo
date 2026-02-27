# Mobile Release Checklist (Android + iOS)

Tài liệu này dùng cho bản Capacitor của Lingo.

## 1) Chuẩn bị chung

1. Cập nhật version app:
   - Android: `android/app/build.gradle` (`versionCode`, `versionName`)
   - iOS: Xcode `Target > General > Identity` (`Version`, `Build`)
2. Build web + sync native:
   - `npm run mobile:sync`
3. Kiểm tra icon/splash đã được generate:
   - iOS: `ios/App/App/Assets.xcassets`
   - Android: `android/app/src/main/res/mipmap*`, `drawable*`

## 2) Android (.aab)

### 2.1 Tạo keystore (làm 1 lần)

```bash
keytool -genkey -v -keystore release.keystore -alias lingo_release -keyalg RSA -keysize 2048 -validity 10000
```

Lưu `release.keystore` ở thư mục root project.

### 2.2 Tạo file cấu hình ký

1. Copy `android/key.properties.example` -> `android/key.properties`
2. Điền thông tin thật:
   - `storeFile=../release.keystore`
   - `storePassword=...`
   - `keyAlias=lingo_release`
   - `keyPassword=...`

### 2.3 Build AAB

```bash
npm run mobile:build:android:aab
```

Output:
- `android/app/build/outputs/bundle/release/app-release.aab`

### 2.4 Verify trước khi upload

1. Cài thử build debug/release trên thiết bị thật
2. Kiểm tra login + ghép cặp + đồng bộ dữ liệu
3. Mở Play Console và upload `.aab`

## 3) iOS (Archive / TestFlight / App Store)

Yêu cầu:
- macOS + Xcode
- Apple Developer Program

### 3.1 Chuẩn bị signing

1. Mở `ios/App/App.xcodeproj`
2. Chọn target `App`
3. `Signing & Capabilities`:
   - Team: chọn team Apple của bạn
   - Bundle Identifier: ví dụ `com.lingo.app`
   - Signing Certificate: Apple Distribution
   - Provisioning Profile: Automatic hoặc profile distribution thủ công

### 3.2 Build archive

1. Chọn scheme `App`
2. Chọn destination `Any iOS Device (arm64)`
3. `Product > Archive`

Hoặc chạy script:

```bash
npm run mobile:build:ios:archive
```

### 3.3 Xuất bản

1. Mở Organizer sau khi archive
2. `Distribute App`
3. Chọn:
   - TestFlight (Internal/External testing), hoặc
   - App Store Connect (production)

### 3.4 Ad Hoc IPA (không qua App Store public)

1. Cập nhật `ios/ExportOptionsAdHoc.plist`:
   - `teamID` -> Team ID thật của bạn
2. Đảm bảo đã add UDID thiết bị cần cài trong Apple Developer
3. Build IPA:

```bash
npm run mobile:build:ios:ipa:adhoc
```

Output:
- `ios/build/adhoc/App.ipa`

4. Cài thử qua Apple Configurator/TestFlight internal distribution tools phù hợp.

## 4) Checklist QA trước phát hành

1. Đăng ký/đăng nhập `username + password`
2. Cập nhật hồ sơ cá nhân (tên, ngày sinh, giới tính, avatar)
3. Tạo phòng + nhập ngày bắt đầu
4. Ghép cặp từ thiết bị thứ hai (Android <-> iOS)
5. Hồ sơ hiển thị đúng:
   - Người tạo bên trái
   - Người tham gia bên phải
6. CRUD sự kiện ngày đặc biệt hoạt động
7. Đồng bộ realtime ổn sau app restart
8. Route privacy mở được trên web domain

## 5) Bảo mật và vận hành

1. Không commit:
   - `android/key.properties`
   - `*.keystore`, `*.jks`
2. Giữ an toàn keystore và mật khẩu
3. Sao lưu keystore ở nơi bảo mật (mất keystore sẽ không cập nhật app cũ được)
