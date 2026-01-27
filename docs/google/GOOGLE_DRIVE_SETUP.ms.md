# Panduan Persediaan Sandaran Google Drive

> **Bahasa**: [🇺🇸 English](GOOGLE_DRIVE_SETUP.en.md) | [🇻🇳 Tiếng Việt](GOOGLE_DRIVE_SETUP.vi.md) | [🇮🇩 Bahasa Indonesia](GOOGLE_DRIVE_SETUP.id.md) | [🇨🇳 中文](GOOGLE_DRIVE_SETUP.zh.md) | [🇰🇷 한국어](GOOGLE_DRIVE_SETUP.ko.md) | [🇯🇵 日本語](GOOGLE_DRIVE_SETUP.ja.md) | [🇫🇷 Français](GOOGLE_DRIVE_SETUP.fr.md) | [🇩🇪 Deutsch](GOOGLE_DRIVE_SETUP.de.md) | [🇪🇸 Español](GOOGLE_DRIVE_SETUP.es.md) | [🇹🇭 ภาษาไทย](GOOGLE_DRIVE_SETUP.th.md) | [🇲🇾 Bahasa Melayu](GOOGLE_DRIVE_SETUP.ms.md) | [🇷🇺 Русский](GOOGLE_DRIVE_SETUP.ru.md) | [🇵🇭 Filipino](GOOGLE_DRIVE_SETUP.fil.md) | [🇧🇷 Português](GOOGLE_DRIVE_SETUP.pt.md)

---

## Langkah 1: Cipta Projek Google Cloud

1. Pergi ke [Google Cloud Console](https://console.cloud.google.com/)
2. Klik **"Projek Baharu"** di sudut kanan atas
3. Namakan projek anda: `Marix SSH Client` atau mana-mana nama pilihan anda
4. Klik **"Cipta"**

## Langkah 2: Aktifkan Google Drive API

1. Dalam projek baharu anda, pergi ke **"API & Perkhidmatan"** > **"Pustaka"**
2. Cari **"Google Drive API"**
3. Klik hasil dan tekan **"Aktifkan"**

## Langkah 3: Cipta Kredensial OAuth 2.0

### 3.1. Konfigurasikan Skrin Persetujuan OAuth

1. Pergi ke **"API & Perkhidmatan"** > **"Skrin persetujuan OAuth"**
2. Pilih **"Luaran"** (membenarkan semua pengguna akaun Google)
3. Klik **"Cipta"**

**Maklumat aplikasi:**
- Nama aplikasi: `Marix SSH Client`
- E-mel sokongan pengguna: `your-email@gmail.com`
- Logo aplikasi: (pilihan)
- Laman utama aplikasi: `https://github.com/marixdev/marix`

**Maklumat hubungan pembangun:**
- Alamat e-mel: `your-email@gmail.com`

4. Klik **"Simpan dan teruskan"**

**Skop:**
5. Klik **"Tambah atau alih keluar skop"**
6. Cari dan pilih:
   - `https://www.googleapis.com/auth/drive.file`
7. Klik **"Kemas kini"** dan **"Simpan dan teruskan"**

### 3.2. Cipta ID Klien OAuth

1. Pergi ke **"API & Perkhidmatan"** > **"Kredensial"**
2. Klik **"Cipta kredensial"** > **"ID klien OAuth"**
3. Pilih **"Aplikasi desktop"**
4. Namakannya: `Marix Desktop Client`
5. Klik **"Cipta"**

6. **Muat turun fail JSON**: Klik ikon muat turun
7. **Untuk pembangunan tempatan**: Cipta `google-credentials.json` dalam `src/main/services/`:
```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "YOUR_CLIENT_SECRET"
  }
}
```

8. **Untuk CI/CD builds**: Gunakan GitHub Secrets (lihat di bawah)

## Langkah 4: Konfigurasikan dalam Marix

### Pilihan A: Pembangunan Tempatan

1. Salin fail `google-credentials.json` ke folder `src/main/services/`
2. **PENTING**: Tambah ke `.gitignore`:
```
src/main/services/google-credentials.json
```

### Pilihan B: CI/CD dengan GitHub Secrets (Disyorkan)

1. Pergi ke repositori GitHub anda → **Settings** → **Secrets and variables** → **Actions**
2. Tambah secrets ini:
   - `GOOGLE_CLIENT_ID`: OAuth Client ID anda
   - `GOOGLE_CLIENT_SECRET`: OAuth Client Secret anda
3. Workflow build akan secara automatik menyuntik kredensial semasa build

## Langkah 5: Uji Aliran OAuth

1. Buka aplikasi Marix
2. Pergi ke **Tetapan** > **Sandaran & Pulihkan**
3. Pilih tab **"Google Drive"**
4. Klik **"Sambung ke Google Drive"**
5. Pelayar akan dibuka dengan skrin OAuth Google
6. Pilih akaun Google anda dan berikan kebenaran
7. Aplikasi akan menerima token dan memaparkan "Disambungkan"

## Nota Keselamatan

- **JANGAN** commit `google-credentials.json` ke Git
- Gunakan **GitHub Secrets** untuk CI/CD builds untuk melindungi client_secret
- Token muat semula disimpan dalam Electron store (disulitkan)
- PKCE digunakan untuk keselamatan OAuth tambahan

## Terbitkan Aplikasi (Diperlukan)

1. Pergi ke **Skrin persetujuan OAuth**
2. Klik **"Terbitkan aplikasi"**
3. Aplikasi anda akan diluluskan serta-merta
4. Sesiapa boleh menggunakannya tanpa amaran "aplikasi tidak disahkan"

## Penyelesaian Masalah

### Ralat: "Access blocked: This app's request is invalid"
- Semak bahawa skrin persetujuan OAuth dikonfigurasi sepenuhnya

### Ralat: "The OAuth client was not found"
- Sahkan Client ID dalam fail kredensial
- Muat turun semula fail JSON dari Google Cloud Console

### Ralat: "Access denied"
- Pengguna menolak pemberian kebenaran
