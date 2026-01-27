# Guía de Configuración de Microsoft OneDrive OAuth2

Esta guía le ayuda a configurar la autenticación OAuth2 de OneDrive para Marix.

## Requisitos Previos

- Una cuenta de Microsoft personal
- Acceso al [Portal de Azure](https://portal.azure.com)

## Paso 1: Registrar una Nueva Aplicación

1. Vaya a [Portal de Azure - Registros de aplicaciones](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Haga clic en **"Nuevo registro"**
3. Complete los detalles:
   - **Nombre**: `Marix SSH Client`
   - **Tipos de cuenta compatibles**: Seleccione **"Solo cuentas personales de Microsoft"**
   - **URI de redirección**: Dejar vacío (se añadirá en el paso 3)
4. Haga clic en **"Registrar"**

## Paso 2: Anotar el ID de Aplicación

Después del registro:
1. Copie el **ID de aplicación (cliente)**
2. Guárdelo en un lugar seguro

## Paso 3: Configurar Autenticación (Puerto Aleatorio)

Marix usa redirección **RFC 8252** con puertos aleatorios para mayor seguridad.

1. Haga clic en **"Autenticación"**
2. En **"Configuraciones de plataforma"**, haga clic en **"Agregar una plataforma"**
3. Seleccione **"Aplicaciones móviles y de escritorio"**
4. ⚠️ **Importante**: Agregue MÚLTIPLES URIs de redirección:
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
5. También marque: `https://login.microsoftonline.com/common/oauth2/nativeclient`
6. En **"Configuración avanzada"**:
   - Establezca **"Permitir flujos de cliente público"** en **Sí** ⚠️
7. Haga clic en **"Guardar"**

## Paso 4: Configurar Permisos de API

1. Haga clic en **"Permisos de API"**
2. Haga clic en **"Agregar un permiso"**
3. Seleccione **"Microsoft Graph"** → **"Permisos delegados"**
4. Agregue:
   - ✅ `Files.ReadWrite`
   - ✅ `User.Read`
   - ✅ `offline_access`
5. Haga clic en **"Agregar permisos"**

## Paso 5: Crear Archivo de Credenciales

**Para desarrollo local**: Edite `src/main/services/onedrive-credentials.json`:

```json
{
  "client_id": "SU_ID_DE_CLIENTE"
}
```

**Para builds CI/CD**: Use GitHub Secrets (ver abajo)

## Paso 6: Configurar en Marix

### Opción A: Desarrollo local

1. Cree el archivo `onedrive-credentials.json` en la carpeta `src/main/services/`
2. **IMPORTANTE**: Agregue a `.gitignore`:
```
src/main/services/onedrive-credentials.json
```

### Opción B: CI/CD con GitHub Secrets (Recomendado)

1. Vaya a su repositorio GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Agregue este secret:
   - `ONEDRIVE_CLIENT_ID`: Su OAuth Application (Client) ID
3. El flujo de trabajo de build inyectará automáticamente las credenciales

## Paso 7: Compilar y Probar

```bash
npm run build
npm start
```

## Notas de Seguridad

- ✅ **PKCE**: No requiere client_secret
- ✅ **RFC 8252**: Redirección loopback con puertos aleatorios
- ✅ **Cifrado E2E**: Argon2id + AES-256-GCM
- 📁 **Ubicación**: `/Marix/backup.marix`
- Use **GitHub Secrets** para builds CI/CD para proteger credenciales
