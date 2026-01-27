# Panduan Persediaan Microsoft OneDrive OAuth2

Panduan ini membantu anda menyediakan pengesahan OneDrive OAuth2 untuk Marix.

## Prasyarat

- Akaun Microsoft peribadi
- Akses ke [Portal Azure](https://portal.azure.com)

## Langkah 1: Daftar Aplikasi Baharu

1. Pergi ke [Portal Azure - Pendaftaran aplikasi](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Klik **"Pendaftaran baharu"**
3. Isi butiran:
   - **Nama**: `Marix SSH Client`
   - **Jenis akaun yang disokong**: Pilih **"Hanya akaun Microsoft peribadi"**
   - **URI Ubah hala**: Kosongkan (akan ditambah di langkah 3)
4. Klik **"Daftar"**

## Langkah 2: Catat ID Aplikasi

Selepas pendaftaran:
1. Salin **ID Aplikasi (klien)**
2. Simpan di tempat yang selamat

## Langkah 3: Konfigurasi Pengesahan (Port Rawak)

Marix menggunakan ubah hala **RFC 8252** dengan port rawak untuk keselamatan.

1. Klik **"Pengesahan"**
2. Di **"Konfigurasi platform"**, klik **"Tambah platform"**
3. Pilih **"Aplikasi mudah alih dan desktop"**
4. ⚠️ **Penting**: Tambah BEBERAPA URI ubah hala:
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
5. Tandakan juga: `https://login.microsoftonline.com/common/oauth2/nativeclient`
6. Di **"Tetapan lanjutan"**:
   - Tetapkan **"Benarkan aliran klien awam"** kepada **Ya** ⚠️
7. Klik **"Simpan"**

## Langkah 4: Konfigurasi Kebenaran API

1. Klik **"Kebenaran API"**
2. Klik **"Tambah kebenaran"**
3. Pilih **"Microsoft Graph"** → **"Kebenaran yang diwakilkan"**
4. Tambah:
   - ✅ `Files.ReadWrite`
   - ✅ `User.Read`
   - ✅ `offline_access`
5. Klik **"Tambah kebenaran"**

## Langkah 5: Cipta Fail Kredensial

**Untuk pembangunan tempatan**: Edit `src/main/services/onedrive-credentials.json`:

```json
{
  "client_id": "ID_KLIEN_ANDA"
}
```

**Untuk CI/CD builds**: Gunakan GitHub Secrets (lihat di bawah)

## Langkah 6: Konfigurasikan dalam Marix

### Pilihan A: Pembangunan Tempatan

1. Cipta fail `onedrive-credentials.json` dalam folder `src/main/services/`
2. **PENTING**: Tambah ke `.gitignore`:
```
src/main/services/onedrive-credentials.json
```

### Pilihan B: CI/CD dengan GitHub Secrets (Disyorkan)

1. Pergi ke repositori GitHub anda → **Settings** → **Secrets and variables** → **Actions**
2. Tambah secret ini:
   - `ONEDRIVE_CLIENT_ID`: OAuth Application (Client) ID anda
3. Workflow build akan secara automatik menyuntik kredensial semasa build

## Langkah 7: Bina dan Uji

```bash
npm run build
npm start
```

## Nota Keselamatan

- ✅ **PKCE**: Tidak perlu client_secret
- ✅ **RFC 8252**: Ubah hala loopback dengan port rawak
- ✅ **Penyulitan E2E**: Argon2id + AES-256-GCM
- 📁 **Lokasi simpanan**: `/Marix/backup.marix`
- Gunakan **GitHub Secrets** untuk CI/CD builds untuk melindungi kredensial
