# Guía de configuración de respaldo de Google Drive

> **Idiomas**: [🇺🇸 English](GOOGLE_DRIVE_SETUP.en.md) | [🇻🇳 Tiếng Việt](GOOGLE_DRIVE_SETUP.vi.md) | [🇮🇩 Bahasa Indonesia](GOOGLE_DRIVE_SETUP.id.md) | [🇨🇳 中文](GOOGLE_DRIVE_SETUP.zh.md) | [🇰🇷 한국어](GOOGLE_DRIVE_SETUP.ko.md) | [🇯🇵 日本語](GOOGLE_DRIVE_SETUP.ja.md) | [🇫🇷 Français](GOOGLE_DRIVE_SETUP.fr.md) | [🇩🇪 Deutsch](GOOGLE_DRIVE_SETUP.de.md) | [🇪🇸 Español](GOOGLE_DRIVE_SETUP.es.md) | [🇹🇭 ภาษาไทย](GOOGLE_DRIVE_SETUP.th.md) | [🇲🇾 Bahasa Melayu](GOOGLE_DRIVE_SETUP.ms.md) | [🇷🇺 Русский](GOOGLE_DRIVE_SETUP.ru.md) | [🇵🇭 Filipino](GOOGLE_DRIVE_SETUP.fil.md) | [🇧🇷 Português](GOOGLE_DRIVE_SETUP.pt.md)

---

## Paso 1: Crear proyecto de Google Cloud

1. Vaya a [Google Cloud Console](https://console.cloud.google.com/)
2. Haga clic en **"Nuevo proyecto"** en la esquina superior derecha
3. Nombre su proyecto: `Marix SSH Client` o cualquier nombre que prefiera
4. Haga clic en **"Crear"**

## Paso 2: Habilitar API de Google Drive

1. En su proyecto recién creado, vaya a **"APIs y servicios"** > **"Biblioteca"**
2. Busque **"Google Drive API"**
3. Haga clic en el resultado y presione **"Habilitar"**

## Paso 3: Crear credenciales OAuth 2.0

### 3.1. Configurar pantalla de consentimiento OAuth

1. Vaya a **"APIs y servicios"** > **"Pantalla de consentimiento OAuth"**
2. Seleccione **"Externo"** (permite cualquier usuario de cuenta Google)
3. Haga clic en **"Crear"**

**Información de la aplicación:**
- Nombre de la aplicación: `Marix SSH Client`
- Correo de soporte al usuario: `your-email@gmail.com`
- Logo de la aplicación: (opcional)
- Página de inicio de la aplicación: `https://github.com/marixdev/marix`

**Información de contacto del desarrollador:**
- Direcciones de correo: `your-email@gmail.com`

4. Haga clic en **"Guardar y continuar"**

**Ámbitos:**
5. Haga clic en **"Agregar o quitar ámbitos"**
6. Busque y seleccione:
   - `https://www.googleapis.com/auth/drive.file`
7. Haga clic en **"Actualizar"** y **"Guardar y continuar"**

### 3.2. Crear ID de cliente OAuth

1. Vaya a **"APIs y servicios"** > **"Credenciales"**
2. Haga clic en **"Crear credenciales"** > **"ID de cliente OAuth"**
3. Seleccione **"Aplicación de escritorio"**
4. Nómbrelo: `Marix Desktop Client`
5. Haga clic en **"Crear"**

6. **Descargar archivo JSON**: Haga clic en el icono de descarga
7. **Para desarrollo local**: Cree `google-credentials.json` en `src/main/services/`:
```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "YOUR_CLIENT_SECRET"
  }
}
```

8. **Para builds CI/CD**: Use GitHub Secrets (ver abajo)

## Paso 4: Configurar en Marix

### Opción A: Desarrollo local

1. Copie el archivo `google-credentials.json` en la carpeta `src/main/services/`
2. **IMPORTANTE**: Agregue a `.gitignore`:
```
src/main/services/google-credentials.json
```

### Opción B: CI/CD con GitHub Secrets (Recomendado)

1. Vaya a su repositorio GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Agregue estos secrets:
   - `GOOGLE_CLIENT_ID`: Su OAuth Client ID
   - `GOOGLE_CLIENT_SECRET`: Su OAuth Client Secret
3. El flujo de trabajo de build inyectará automáticamente las credenciales

## Paso 5: Probar flujo OAuth

1. Abra la aplicación Marix
2. Vaya a **Configuración** > **Respaldo y restauración**
3. Seleccione la pestaña **"Google Drive"**
4. Haga clic en **"Conectar a Google Drive"**
5. El navegador se abrirá con la pantalla OAuth de Google
6. Seleccione su cuenta de Google y otorgue permisos
7. La aplicación recibirá el token y mostrará "Conectado"

## Notas de seguridad

- **NO** hacer commit de `google-credentials.json` en Git
- Use **GitHub Secrets** para builds CI/CD para proteger client_secret
- Los tokens de actualización se almacenan en Electron store (cifrados)
- PKCE se usa para seguridad adicional del flujo OAuth

## Publicar aplicación (Obligatorio)

1. Vaya a **Pantalla de consentimiento OAuth**
2. Haga clic en **"Publicar aplicación"**
3. Su aplicación será aprobada inmediatamente
4. Cualquiera puede usarla sin advertencias de "aplicación no verificada"

## Solución de problemas

### Error: "Access blocked: This app's request is invalid"
- Verifique que la pantalla de consentimiento OAuth esté completamente configurada

### Error: "The OAuth client was not found"
- Verifique el Client ID en el archivo de credenciales
- Descargue nuevamente el archivo JSON desde Google Cloud Console

### Error: "Access denied"
- El usuario denegó el permiso
