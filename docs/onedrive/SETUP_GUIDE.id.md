# Panduan Pengaturan Microsoft OneDrive OAuth2

Panduan ini membantu Anda mengatur autentikasi OneDrive OAuth2 untuk Marix.

## Prasyarat

- Akun Microsoft pribadi
- Akses ke [Portal Azure](https://portal.azure.com)

## Langkah 1: Daftarkan Aplikasi Baru

1. Buka [Portal Azure - Pendaftaran aplikasi](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Klik **"Pendaftaran baru"**
3. Isi detail:
   - **Nama**: `Marix SSH Client`
   - **Jenis akun yang didukung**: Pilih **"Hanya akun Microsoft pribadi"**
   - **URI Pengalihan**: Kosongkan (akan ditambahkan di langkah 3)
4. Klik **"Daftar"**

## Langkah 2: Catat ID Aplikasi

Setelah pendaftaran:
1. Salin **ID Aplikasi (klien)**
2. Simpan di tempat yang aman

## Langkah 3: Konfigurasi Autentikasi (Port Acak)

Marix menggunakan pengalihan **RFC 8252** dengan port acak untuk keamanan.

1. Klik **"Autentikasi"**
2. Di **"Konfigurasi platform"**, klik **"Tambahkan platform"**
3. Pilih **"Aplikasi seluler dan desktop"**
4. ⚠️ **Penting**: Tambahkan BEBERAPA URI pengalihan:
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
5. Centang juga: `https://login.microsoftonline.com/common/oauth2/nativeclient`
6. Di **"Pengaturan lanjutan"**:
   - Atur **"Izinkan alur klien publik"** ke **Ya** ⚠️
7. Klik **"Simpan"**

## Langkah 4: Konfigurasi Izin API

1. Klik **"Izin API"**
2. Klik **"Tambahkan izin"**
3. Pilih **"Microsoft Graph"** → **"Izin yang didelegasikan"**
4. Tambahkan:
   - ✅ `Files.ReadWrite`
   - ✅ `User.Read`
   - ✅ `offline_access`
5. Klik **"Tambahkan izin"**

## Langkah 5: Buat File Kredensial

**Untuk pengembangan lokal**: Edit `src/main/services/onedrive-credentials.json`:

```json
{
  "client_id": "ID_KLIEN_ANDA"
}
```

**Untuk build CI/CD**: Gunakan GitHub Secrets (lihat di bawah)

## Langkah 6: Konfigurasikan di Marix

### Opsi A: Pengembangan Lokal

1. Buat file `onedrive-credentials.json` di folder `src/main/services/`
2. **PENTING**: Tambahkan ke `.gitignore`:
```
src/main/services/onedrive-credentials.json
```

### Opsi B: CI/CD dengan GitHub Secrets (Direkomendasikan)

1. Buka repositori GitHub Anda → **Settings** → **Secrets and variables** → **Actions**
2. Tambahkan secret ini:
   - `ONEDRIVE_CLIENT_ID`: OAuth Application (Client) ID Anda
3. Workflow build akan otomatis menyuntikkan kredensial saat build

## Langkah 7: Build dan Uji

```bash
npm run build
npm start
```

## Catatan Keamanan

- ✅ **PKCE**: Tidak perlu client_secret
- ✅ **RFC 8252**: Pengalihan loopback dengan port acak
- ✅ **Enkripsi E2E**: Argon2id + AES-256-GCM
- 📁 **Lokasi penyimpanan**: `/Marix/backup.marix`
- Gunakan **GitHub Secrets** untuk build CI/CD untuk melindungi kredensial
