# Microsoft OneDrive OAuth2 セットアップガイド

このガイドでは、MarixのOneDrive OAuth2認証の設定方法を説明します。

## 前提条件

- 個人のMicrosoftアカウント
- [Azureポータル](https://portal.azure.com)へのアクセス

## ステップ1: 新しいアプリケーションを登録

1. [Azureポータル - アプリの登録](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)にアクセス
2. **「新規登録」**をクリック
3. 詳細を入力:
   - **名前**: `Marix SSH Client`
   - **サポートされているアカウントの種類**: **「個人のMicrosoftアカウントのみ」**を選択
   - **リダイレクトURI**: 空のままにする（ステップ3で追加）
4. **「登録」**をクリック

## ステップ2: アプリケーションIDをメモ

登録後:
1. **アプリケーション（クライアント）ID**をコピー
2. 安全な場所に保存

## ステップ3: 認証を構成（ランダムポート）

Marixはセキュリティのため、**RFC 8252**準拠のループバックリダイレクトとランダムポートを使用します。

1. **「認証」**をクリック
2. **「プラットフォーム構成」**で、**「プラットフォームの追加」**をクリック
3. **「モバイルおよびデスクトップアプリケーション」**を選択
4. ⚠️ **重要**: 複数のリダイレクトURIを追加:
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
5. `https://login.microsoftonline.com/common/oauth2/nativeclient`もチェック
6. **「詳細設定」**で:
   - **「パブリッククライアントフローを許可する」**を**はい**に設定 ⚠️
7. **「保存」**をクリック

## ステップ4: APIアクセス許可を構成

1. **「APIのアクセス許可」**をクリック
2. **「アクセス許可の追加」**をクリック
3. **「Microsoft Graph」** → **「委任されたアクセス許可」**を選択
4. 追加:
   - ✅ `Files.ReadWrite`
   - ✅ `User.Read`
   - ✅ `offline_access`
5. **「アクセス許可の追加」**をクリック

## ステップ5: 資格情報ファイルを作成

**ローカル開発用**: `src/main/services/onedrive-credentials.json`を編集:

```json
{
  "client_id": "あなたのクライアントID"
}
```

**CI/CDビルド用**: GitHub Secretsを使用（下記参照）

## ステップ6: Marixで設定

### オプションA: ローカル開発

1. `src/main/services/`フォルダに`onedrive-credentials.json`ファイルを作成
2. **重要**: `.gitignore`に追加:
```
src/main/services/onedrive-credentials.json
```

### オプションB: GitHub SecretsでCI/CD（推奨）

1. GitHubリポジトリ → **Settings** → **Secrets and variables** → **Actions**に移動
2. このシークレットを追加:
   - `ONEDRIVE_CLIENT_ID`: OAuthアプリケーション（クライアント）ID
3. ビルドワークフローがビルド時に自動的に認証情報を注入

## ステップ7: ビルドとテスト

```bash
npm run build
npm start
```

## セキュリティノート

- ✅ **PKCE**: client_secret不要
- ✅ **RFC 8252**: ランダムポートでループバックリダイレクト
- ✅ **E2E暗号化**: Argon2id + AES-256-GCM
- 📁 **保存場所**: `/Marix/backup.marix`
- CI/CDビルドには資格情報を保護するために**GitHub Secrets**を使用
