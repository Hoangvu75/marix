# Google Driveバックアップ設定ガイド

> **言語**: [🇺🇸 English](GOOGLE_DRIVE_SETUP.en.md) | [🇻🇳 Tiếng Việt](GOOGLE_DRIVE_SETUP.vi.md) | [🇮🇩 Bahasa Indonesia](GOOGLE_DRIVE_SETUP.id.md) | [🇨🇳 中文](GOOGLE_DRIVE_SETUP.zh.md) | [🇰🇷 한국어](GOOGLE_DRIVE_SETUP.ko.md) | [🇯🇵 日本語](GOOGLE_DRIVE_SETUP.ja.md) | [🇫🇷 Français](GOOGLE_DRIVE_SETUP.fr.md) | [🇩🇪 Deutsch](GOOGLE_DRIVE_SETUP.de.md) | [🇪🇸 Español](GOOGLE_DRIVE_SETUP.es.md) | [🇹🇭 ภาษาไทย](GOOGLE_DRIVE_SETUP.th.md) | [🇲🇾 Bahasa Melayu](GOOGLE_DRIVE_SETUP.ms.md) | [🇷🇺 Русский](GOOGLE_DRIVE_SETUP.ru.md) | [🇵🇭 Filipino](GOOGLE_DRIVE_SETUP.fil.md) | [🇧🇷 Português](GOOGLE_DRIVE_SETUP.pt.md)

---

## ステップ1：Google Cloudプロジェクトを作成

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 右上の**「新しいプロジェクト」**をクリック
3. プロジェクト名を入力：`Marix SSH Client`またはお好みの名前
4. **「作成」**をクリック

## ステップ2：Google Drive APIを有効化

1. 新しく作成したプロジェクトで、**「APIとサービス」** > **「ライブラリ」**に移動
2. **「Google Drive API」**を検索
3. 結果をクリックし、**「有効にする」**を押す

## ステップ3：OAuth 2.0認証情報を作成

### 3.1. OAuth同意画面を設定

1. **「APIとサービス」** > **「OAuth同意画面」**に移動
2. **「外部」**を選択（任意のGoogleアカウントユーザーを許可）
3. **「作成」**をクリック

**アプリ情報：**
- アプリ名：`Marix SSH Client`
- ユーザーサポートメール：`your-email@gmail.com`
- アプリロゴ：（オプション）
- アプリのホームページ：`https://github.com/marixdev/marix`

**デベロッパー連絡先情報：**
- メールアドレス：`your-email@gmail.com`

4. **「保存して続行」**をクリック

**スコープ：**
5. **「スコープを追加または削除」**をクリック
6. 次のスコープを見つけて選択：
   - `https://www.googleapis.com/auth/drive.file`
7. **「更新」**と**「保存して続行」**をクリック

### 3.2. OAuthクライアントIDを作成

1. **「APIとサービス」** > **「認証情報」**に移動
2. **「認証情報を作成」** > **「OAuthクライアントID」**をクリック
3. **「デスクトップアプリ」**を選択
4. 名前を入力：`Marix Desktop Client`
5. **「作成」**をクリック

6. **JSONファイルをダウンロード**：ダウンロードアイコンをクリック
7. **ローカル開発用**：`src/main/services/`に`google-credentials.json`を作成：
```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "YOUR_CLIENT_SECRET"
  }
}
```

8. **CI/CDビルド用**：GitHub Secretsを使用（下記参照）

## ステップ4：Marixで設定

### オプションA：ローカル開発

1. `google-credentials.json`ファイルを`src/main/services/`フォルダにコピー
2. **重要**：`.gitignore`に追加：
```
src/main/services/google-credentials.json
```

### オプションB：GitHub SecretsでCI/CD（推奨）

1. GitHubリポジトリ → **Settings** → **Secrets and variables** → **Actions**に移動
2. これらのシークレットを追加：
   - `GOOGLE_CLIENT_ID`：OAuthクライアントID
   - `GOOGLE_CLIENT_SECRET`：OAuthクライアントシークレット
3. ビルドワークフローがビルド時に自動的に認証情報を注入

## ステップ5：OAuthフローをテスト

1. Marixアプリを開く
2. **設定** > **バックアップと復元**に移動
3. **「Google Drive」**タブを選択
4. **「Google Driveに接続」**をクリック
5. ブラウザがGoogle OAuth画面で開きます
6. Googleアカウントを選択し、権限を付与
7. アプリがトークンを受け取り、「接続済み」と表示

## セキュリティノート

- `google-credentials.json`をGitにコミット**しないでください**
- CI/CDビルドにはclient_secretを保護するために**GitHub Secrets**を使用
- リフレッシュトークンはElectronストアに保存（暗号化済み）
- 追加のOAuthセキュリティのためにPKCEを使用

## アプリを公開（必須）

1. **OAuth同意画面**に移動
2. **「アプリを公開」**をクリック
3. アプリは即座に承認されます
4. 誰でも「未確認のアプリ」警告なしで使用できます

## トラブルシューティング

### エラー："Access blocked: This app's request is invalid"
- OAuth同意画面が完全に設定されているか確認

### エラー："The OAuth client was not found"
- 認証情報ファイルのクライアントIDを確認
- Google Cloud ConsoleからJSONファイルを再ダウンロード

### エラー："Access denied"
- ユーザーが権限の付与を拒否しました
