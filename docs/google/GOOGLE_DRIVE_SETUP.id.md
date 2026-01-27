# Panduan Pengaturan Cadangan Google Drive

> **Bahasa**: [🇺🇸 English](GOOGLE_DRIVE_SETUP.en.md) | [🇻🇳 Tiếng Việt](GOOGLE_DRIVE_SETUP.vi.md) | [🇮🇩 Bahasa Indonesia](GOOGLE_DRIVE_SETUP.id.md) | [🇨🇳 中文](GOOGLE_DRIVE_SETUP.zh.md) | [🇰🇷 한국어](GOOGLE_DRIVE_SETUP.ko.md) | [🇯🇵 日本語](GOOGLE_DRIVE_SETUP.ja.md) | [🇫🇷 Français](GOOGLE_DRIVE_SETUP.fr.md) | [🇩🇪 Deutsch](GOOGLE_DRIVE_SETUP.de.md) | [🇪🇸 Español](GOOGLE_DRIVE_SETUP.es.md) | [🇹🇭 ภาษาไทย](GOOGLE_DRIVE_SETUP.th.md) | [🇲🇾 Bahasa Melayu](GOOGLE_DRIVE_SETUP.ms.md) | [🇷🇺 Русский](GOOGLE_DRIVE_SETUP.ru.md) | [🇵🇭 Filipino](GOOGLE_DRIVE_SETUP.fil.md) | [🇧🇷 Português](GOOGLE_DRIVE_SETUP.pt.md)

---

## Langkah 1: Buat Proyek Google Cloud

1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Klik **"Proyek Baru"** di pojok kanan atas
3. Beri nama proyek: `Marix SSH Client` atau nama yang Anda inginkan
4. Klik **"Buat"**

## Langkah 2: Aktifkan Google Drive API

1. Di proyek baru Anda, buka **"API & Layanan"** > **"Pustaka"**
2. Cari **"Google Drive API"**
3. Klik hasilnya dan tekan **"Aktifkan"**

## Langkah 3: Buat Kredensial OAuth 2.0

### 3.1. Konfigurasikan Layar Persetujuan OAuth

1. Buka **"API & Layanan"** > **"Layar persetujuan OAuth"**
2. Pilih **"Eksternal"** (mengizinkan semua pengguna akun Google)
3. Klik **"Buat"**

**Informasi aplikasi:**
- Nama aplikasi: `Marix SSH Client`
- Email dukungan pengguna: `your-email@gmail.com`
- Logo aplikasi: (opsional)
- Beranda aplikasi: `https://github.com/marixdev/marix`

**Informasi kontak developer:**
- Alamat email: `your-email@gmail.com`

4. Klik **"Simpan dan lanjutkan"**

**Cakupan:**
5. Klik **"Tambahkan atau hapus cakupan"**
6. Temukan dan pilih:
   - `https://www.googleapis.com/auth/drive.file`
7. Klik **"Perbarui"** dan **"Simpan dan lanjutkan"**

### 3.2. Buat ID Klien OAuth

1. Buka **"API & Layanan"** > **"Kredensial"**
2. Klik **"Buat kredensial"** > **"ID klien OAuth"**
3. Pilih **"Aplikasi desktop"**
4. Beri nama: `Marix Desktop Client`
5. Klik **"Buat"**

6. **Unduh file JSON**: Klik ikon unduh
7. **Untuk pengembangan lokal**: Buat `google-credentials.json` di `src/main/services/`:
```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "YOUR_CLIENT_SECRET"
  }
}
```

8. **Untuk build CI/CD**: Gunakan GitHub Secrets (lihat di bawah)

## Langkah 4: Konfigurasikan di Marix

### Opsi A: Pengembangan Lokal

1. Salin file `google-credentials.json` ke folder `src/main/services/`
2. **PENTING**: Tambahkan ke `.gitignore`:
```
src/main/services/google-credentials.json
```

### Opsi B: CI/CD dengan GitHub Secrets (Direkomendasikan)

1. Buka repositori GitHub Anda → **Settings** → **Secrets and variables** → **Actions**
2. Tambahkan secrets ini:
   - `GOOGLE_CLIENT_ID`: OAuth Client ID Anda
   - `GOOGLE_CLIENT_SECRET`: OAuth Client Secret Anda
3. Workflow build akan otomatis menyuntikkan kredensial saat build

## Langkah 5: Uji Alur OAuth

1. Buka aplikasi Marix
2. Buka **Pengaturan** > **Cadangan & Pulihkan**
3. Pilih tab **"Google Drive"**
4. Klik **"Hubungkan ke Google Drive"**
5. Browser akan terbuka dengan layar OAuth Google
6. Pilih akun Google Anda dan berikan izin
7. Aplikasi akan menerima token dan menampilkan "Terhubung"

## Catatan Keamanan

- **JANGAN** commit `google-credentials.json` ke Git
- Gunakan **GitHub Secrets** untuk build CI/CD untuk melindungi client_secret
- Refresh token disimpan di Electron store (terenkripsi)
- PKCE digunakan untuk keamanan OAuth tambahan

## Publikasikan Aplikasi (Diperlukan)

1. Buka **Layar persetujuan OAuth**
2. Klik **"Publikasikan aplikasi"**
3. Aplikasi Anda akan langsung disetujui
4. Siapa pun dapat menggunakannya tanpa peringatan "aplikasi tidak terverifikasi"

## Pemecahan Masalah

### Error: "Access blocked: This app's request is invalid"
- Periksa apakah layar persetujuan OAuth sudah dikonfigurasi sepenuhnya

### Error: "The OAuth client was not found"
- Verifikasi Client ID di file kredensial
- Unduh ulang file JSON dari Google Cloud Console

### Error: "Access denied"
- Pengguna menolak pemberian izin
