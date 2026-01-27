# Hướng dẫn thiết lập Microsoft OneDrive OAuth2

Hướng dẫn này giúp bạn thiết lập xác thực OneDrive OAuth2 cho tính năng backup/restore của Marix.

## Yêu cầu

- Tài khoản Microsoft (cá nhân)
- Truy cập [Azure Portal](https://portal.azure.com)

## Bước 1: Đăng ký ứng dụng mới

1. Truy cập [Azure Portal - App registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Nhấn **"New registration"**
3. Điền thông tin:
   - **Name**: `Marix SSH Client`
   - **Supported account types**: Chọn **"Personal Microsoft accounts only"**
   - **Redirect URI**: Để trống (sẽ thêm ở bước 3)
4. Nhấn **"Register"**

## Bước 2: Lưu Application (Client) ID

Sau khi đăng ký, bạn sẽ thấy trang overview:

1. Copy **Application (client) ID**
2. Lưu lại ở nơi an toàn

Ví dụ: `12345678-abcd-1234-5678-abcdefghijkl`

## Bước 3: Cấu hình Authentication (Random Port)

Marix sử dụng **RFC 8252** với loopback redirect và random ports để tăng bảo mật.

1. Ở sidebar trái, nhấn **"Authentication"**
2. Trong phần **"Platform configurations"**, nhấn **"Add a platform"**
3. Chọn **"Mobile and desktop applications"**
4. ⚠️ **Quan trọng**: Thêm NHIỀU redirect URIs cho random port:
   ```
   http://127.0.0.1/callback
   http://127.0.0.1:8888/callback
   http://127.0.0.1:8889/callback
   http://127.0.0.1:8890/callback
   http://127.0.0.1:8891/callback
   http://127.0.0.1:8892/callback
   http://127.0.0.1:8893/callback
   http://127.0.0.1:8894/callback
   http://127.0.0.1:8895/callback
   http://127.0.0.1:8896/callback
   http://127.0.0.1:8897/callback
   ```
5. Đánh dấu checkbox: `https://login.microsoftonline.com/common/oauth2/nativeclient`
6. Trong phần **"Advanced settings"**:
   - Đặt **"Allow public client flows"** thành **Yes** ⚠️ (bắt buộc cho PKCE)
7. Nhấn **"Save"**

## Bước 4: Cấu hình API Permissions

1. Ở sidebar trái, nhấn **"API permissions"**
2. Nhấn **"Add a permission"**
3. Chọn **"Microsoft Graph"**
4. Chọn **"Delegated permissions"**
5. Thêm các permissions sau:
   - ✅ `Files.ReadWrite` - Đọc và ghi file
   - ✅ `User.Read` - Đọc profile
   - ✅ `offline_access` - Để nhận refresh token
6. Nhấn **"Add permissions"**

## Bước 5: Tạo file Credentials

**Cho development local**: Sửa file `src/main/services/onedrive-credentials.json`:

```json
{
  "client_id": "YOUR_APPLICATION_CLIENT_ID"
}
```

Chỉ cần vậy thôi! Không cần redirect_uri - Marix tự động xử lý với random ports.

**Cho CI/CD builds**: Sử dụng GitHub Secrets (xem bên dưới)

## Bước 6: Cấu hình trong Marix

### Lựa chọn A: Development Local

1. Tạo file `onedrive-credentials.json` trong thư mục `src/main/services/`
2. **QUAN TRỌNG**: Thêm vào `.gitignore`:
```
src/main/services/onedrive-credentials.json
```

### Lựa chọn B: CI/CD với GitHub Secrets (Khuyến nghị)

1. Vào GitHub repository → **Settings** → **Secrets and variables** → **Actions**
2. Thêm secret sau:
   - `ONEDRIVE_CLIENT_ID`: Application (Client) ID của bạn
3. Build workflow sẽ tự động inject credentials khi build

## Bước 7: Build và Test

```bash
npm run build
npm start
```

1. Vào **Settings** → **Backup & Restore**
2. Nhấn tab **OneDrive**
3. Nhấn **"Connect to OneDrive"**
4. Đăng nhập bằng tài khoản Microsoft
5. Thành công sẽ hiển thị "Connected to OneDrive"

## Xử lý lỗi thường gặp

### Lỗi: "AADSTS50011: The reply URL does not match"

**Cách sửa**: Thêm nhiều redirect URIs hơn trong Azure Authentication. Đảm bảo có URIs cho ports 8888-8897.

### Lỗi: "AADSTS7000218: request body must contain client_secret"

**Cách sửa**: 
1. Vào **Authentication** settings
2. Bật **"Allow public client flows"** → **Yes**
3. Lưu và thử lại

### Lỗi: "Request failed with status 403"

**Cách sửa**: Kiểm tra permission `Files.ReadWrite` đã được thêm và cấp quyền.

## Ghi chú bảo mật

- ✅ **PKCE**: Marix dùng PKCE, không cần client_secret
- ✅ **RFC 8252**: Dùng loopback redirect (127.0.0.1) với random ports
- ✅ **Mã hóa E2E**: Dữ liệu mã hóa Argon2id + AES-256-GCM trước khi upload
- 📁 **Vị trí lưu**: `/Marix/backup.marix` trong OneDrive
- Sử dụng **GitHub Secrets** cho CI/CD builds để bảo vệ credentials
