# iOS Ad Hoc IPA Guide (Không lên App Store public)

Hướng dẫn xuất `.ipa` để cài trực tiếp cho thiết bị iPhone đã được cấp quyền (UDID whitelist).

## Điều kiện bắt buộc

1. macOS + Xcode
2. Apple Developer Program (trả phí)
3. Bundle ID app khớp (`com.lingo.app` hoặc ID bạn chọn)
4. Thiết bị iPhone người nhận đã có UDID trong Apple Developer

## Bước 1: Add UDID thiết bị

1. Lấy UDID iPhone người nhận:
   - Finder (macOS) hoặc Apple Configurator
2. Vào Apple Developer:
   - `Certificates, Identifiers & Profiles` -> `Devices` -> add UDID

## Bước 2: Chuẩn bị provisioning profile Ad Hoc

1. Apple Developer -> `Profiles` -> tạo profile loại **Ad Hoc**
2. Chọn đúng App ID
3. Chọn certificate distribution
4. Chọn thiết bị vừa add UDID
5. Download profile và cài vào máy Mac/Xcode

## Bước 3: Cấu hình Xcode

1. Mở `ios/App/App.xcodeproj`
2. Chọn target `App` -> `Signing & Capabilities`
3. Chọn Team đúng
4. Đảm bảo certificate/provisioning profile hợp lệ

## Bước 4: Cấu hình Export Options

Sửa file `ios/ExportOptionsAdHoc.plist`:

- `teamID` -> Team ID thật của bạn

## Bước 5: Build IPA Ad Hoc

```bash
npm run mobile:build:ios:ipa:adhoc
```

Output:
- `ios/build/adhoc/App.ipa`

## Bước 6: Gửi và cài IPA

Cách đơn giản:
1. Dùng Apple Configurator 2 để cài trực tiếp lên iPhone
2. Hoặc dùng dịch vụ phân phối nội bộ hỗ trợ Ad Hoc

## Lỗi thường gặp

1. `No profiles for ... were found`:
   - Chưa tạo đúng profile Ad Hoc hoặc chưa cài profile vào máy
2. `device not in provisioning profile`:
   - Chưa add UDID thiết bị
3. `teamID mismatch`:
   - `ios/ExportOptionsAdHoc.plist` chưa đúng Team ID

## Lưu ý

- Ad Hoc chỉ cài được cho các thiết bị đã whitelist UDID.
- Nếu muốn đơn giản hơn cho người dùng iPhone, dùng TestFlight thường tiện hơn.
