# Guide de configuration de la sauvegarde Google Drive

> **Langues**: [🇺🇸 English](GOOGLE_DRIVE_SETUP.en.md) | [🇻🇳 Tiếng Việt](GOOGLE_DRIVE_SETUP.vi.md) | [🇮🇩 Bahasa Indonesia](GOOGLE_DRIVE_SETUP.id.md) | [🇨🇳 中文](GOOGLE_DRIVE_SETUP.zh.md) | [🇰🇷 한국어](GOOGLE_DRIVE_SETUP.ko.md) | [🇯🇵 日本語](GOOGLE_DRIVE_SETUP.ja.md) | [🇫🇷 Français](GOOGLE_DRIVE_SETUP.fr.md) | [🇩🇪 Deutsch](GOOGLE_DRIVE_SETUP.de.md) | [🇪🇸 Español](GOOGLE_DRIVE_SETUP.es.md) | [🇹🇭 ภาษาไทย](GOOGLE_DRIVE_SETUP.th.md) | [🇲🇾 Bahasa Melayu](GOOGLE_DRIVE_SETUP.ms.md) | [🇷🇺 Русский](GOOGLE_DRIVE_SETUP.ru.md) | [🇵🇭 Filipino](GOOGLE_DRIVE_SETUP.fil.md) | [🇧🇷 Português](GOOGLE_DRIVE_SETUP.pt.md)

---

## Étape 1 : Créer un projet Google Cloud

1. Accédez à [Google Cloud Console](https://console.cloud.google.com/)
2. Cliquez sur **"Nouveau projet"** dans le coin supérieur droit
3. Nommez votre projet : `Marix SSH Client` ou un nom de votre choix
4. Cliquez sur **"Créer"**

## Étape 2 : Activer l'API Google Drive

1. Dans votre projet nouvellement créé, allez dans **"API et services"** > **"Bibliothèque"**
2. Recherchez **"Google Drive API"**
3. Cliquez sur le résultat et appuyez sur **"Activer"**

## Étape 3 : Créer des identifiants OAuth 2.0

### 3.1. Configurer l'écran de consentement OAuth

1. Allez dans **"API et services"** > **"Écran de consentement OAuth"**
2. Sélectionnez **"Externe"** (permet à tout utilisateur de compte Google)
3. Cliquez sur **"Créer"**

**Informations sur l'application :**
- Nom de l'application : `Marix SSH Client`
- E-mail d'assistance utilisateur : `your-email@gmail.com`
- Logo de l'application : (facultatif)
- Page d'accueil de l'application : `https://github.com/marixdev/marix`

**Coordonnées du développeur :**
- Adresses e-mail : `your-email@gmail.com`

4. Cliquez sur **"Enregistrer et continuer"**

**Portées :**
5. Cliquez sur **"Ajouter ou supprimer des portées"**
6. Recherchez et sélectionnez :
   - `https://www.googleapis.com/auth/drive.file`
7. Cliquez sur **"Mettre à jour"** et **"Enregistrer et continuer"**

### 3.2. Créer un ID client OAuth

1. Allez dans **"API et services"** > **"Identifiants"**
2. Cliquez sur **"Créer des identifiants"** > **"ID client OAuth"**
3. Sélectionnez **"Application de bureau"**
4. Nommez-le : `Marix Desktop Client`
5. Cliquez sur **"Créer"**

6. **Télécharger le fichier JSON** : Cliquez sur l'icône de téléchargement
7. **Pour le développement local** : Créez `google-credentials.json` dans `src/main/services/` :
```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "YOUR_CLIENT_SECRET"
  }
}
```

8. **Pour les builds CI/CD** : Utilisez GitHub Secrets (voir ci-dessous)

## Étape 4 : Configurer dans Marix

### Option A : Développement local

1. Copiez le fichier `google-credentials.json` dans le dossier `src/main/services/`
2. **IMPORTANT** : Ajoutez à `.gitignore` :
```
src/main/services/google-credentials.json
```

### Option B : CI/CD avec GitHub Secrets (Recommandé)

1. Allez dans votre dépôt GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Ajoutez ces secrets :
   - `GOOGLE_CLIENT_ID` : Votre OAuth Client ID
   - `GOOGLE_CLIENT_SECRET` : Votre OAuth Client Secret
3. Le workflow de build injectera automatiquement les identifiants lors du build

## Étape 5 : Tester le flux OAuth

1. Ouvrez l'application Marix
2. Allez dans **Paramètres** > **Sauvegarde et restauration**
3. Sélectionnez l'onglet **"Google Drive"**
4. Cliquez sur **"Se connecter à Google Drive"**
5. Le navigateur s'ouvrira avec l'écran OAuth de Google
6. Sélectionnez votre compte Google et accordez les autorisations
7. L'application recevra le jeton et affichera "Connecté"

## Notes de sécurité

- **NE PAS** valider `google-credentials.json` dans Git
- Utilisez **GitHub Secrets** pour les builds CI/CD pour protéger le client_secret
- Les jetons de rafraîchissement sont stockés dans Electron store (chiffrés)
- PKCE est utilisé pour une sécurité OAuth supplémentaire

## Publication de l'application (Obligatoire)

1. Allez dans **Écran de consentement OAuth**
2. Cliquez sur **"Publier l'application"**
3. Votre application sera approuvée immédiatement
4. Tout le monde peut l'utiliser sans avertissement "application non vérifiée"

## Dépannage

### Erreur : "Access blocked: This app's request is invalid"
- Vérifiez que l'écran de consentement OAuth est entièrement configuré

### Erreur : "The OAuth client was not found"
- Vérifiez l'ID client dans le fichier d'identifiants
- Téléchargez à nouveau le fichier JSON depuis Google Cloud Console

### Erreur : "Access denied"
- L'utilisateur a refusé l'octroi de l'autorisation
