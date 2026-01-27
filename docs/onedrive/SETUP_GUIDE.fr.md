# Guide de Configuration OAuth2 Microsoft OneDrive

Ce guide vous aide à configurer l'authentification OAuth2 OneDrive pour Marix.

## Prérequis

- Un compte Microsoft personnel
- Accès au [Portail Azure](https://portal.azure.com)

## Étape 1: Enregistrer une Nouvelle Application

1. Accédez à [Portail Azure - Inscriptions d'applications](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Cliquez sur **"Nouvelle inscription"**
3. Remplissez les détails:
   - **Nom**: `Marix SSH Client`
   - **Types de comptes pris en charge**: Sélectionnez **"Comptes Microsoft personnels uniquement"**
   - **URI de redirection**: Laisser vide (sera ajouté à l'étape 3)
4. Cliquez sur **"Inscrire"**

## Étape 2: Noter l'ID d'Application

Après l'inscription:
1. Copiez l'**ID d'application (client)**
2. Conservez-le en lieu sûr

## Étape 3: Configurer l'Authentification (Port Aléatoire)

Marix utilise la redirection **RFC 8252** avec des ports aléatoires pour plus de sécurité.

1. Cliquez sur **"Authentification"**
2. Sous **"Configurations de plateforme"**, cliquez sur **"Ajouter une plateforme"**
3. Sélectionnez **"Applications mobiles et de bureau"**
4. ⚠️ **Important**: Ajoutez PLUSIEURS URIs de redirection:
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
5. Cochez également: `https://login.microsoftonline.com/common/oauth2/nativeclient`
6. Sous **"Paramètres avancés"**:
   - Définissez **"Autoriser les flux de clients publics"** sur **Oui** ⚠️
7. Cliquez sur **"Enregistrer"**

## Étape 4: Configurer les Autorisations d'API

1. Cliquez sur **"Autorisations d'API"**
2. Cliquez sur **"Ajouter une autorisation"**
3. Sélectionnez **"Microsoft Graph"** → **"Autorisations déléguées"**
4. Ajoutez:
   - ✅ `Files.ReadWrite`
   - ✅ `User.Read`
   - ✅ `offline_access`
5. Cliquez sur **"Ajouter des autorisations"**

## Étape 5: Créer le Fichier d'Identifiants

**Pour le développement local**: Modifiez `src/main/services/onedrive-credentials.json`:

```json
{
  "client_id": "VOTRE_ID_CLIENT"
}
```

**Pour les builds CI/CD**: Utilisez GitHub Secrets (voir ci-dessous)

## Étape 6: Configurer dans Marix

### Option A: Développement local

1. Créez le fichier `onedrive-credentials.json` dans le dossier `src/main/services/`
2. **IMPORTANT**: Ajoutez à `.gitignore`:
```
src/main/services/onedrive-credentials.json
```

### Option B: CI/CD avec GitHub Secrets (Recommandé)

1. Allez dans votre dépôt GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Ajoutez ce secret:
   - `ONEDRIVE_CLIENT_ID`: Votre OAuth Application (Client) ID
3. Le workflow de build injectera automatiquement les identifiants lors du build

## Étape 7: Compiler et Tester

```bash
npm run build
npm start
```

## Notes de Sécurité

- ✅ **PKCE**: Pas de client_secret requis
- ✅ **RFC 8252**: Redirection loopback avec ports aléatoires
- ✅ **Chiffrement E2E**: Argon2id + AES-256-GCM
- 📁 **Emplacement**: `/Marix/backup.marix`
- Utilisez **GitHub Secrets** pour les builds CI/CD pour protéger les identifiants
