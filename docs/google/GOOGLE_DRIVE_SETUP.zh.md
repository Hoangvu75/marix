# Google Drive 备份设置指南

> **语言**: [🇺🇸 English](GOOGLE_DRIVE_SETUP.en.md) | [🇻🇳 Tiếng Việt](GOOGLE_DRIVE_SETUP.vi.md) | [🇮🇩 Bahasa Indonesia](GOOGLE_DRIVE_SETUP.id.md) | [🇨🇳 中文](GOOGLE_DRIVE_SETUP.zh.md) | [🇰🇷 한국어](GOOGLE_DRIVE_SETUP.ko.md) | [🇯🇵 日本語](GOOGLE_DRIVE_SETUP.ja.md) | [🇫🇷 Français](GOOGLE_DRIVE_SETUP.fr.md) | [🇩🇪 Deutsch](GOOGLE_DRIVE_SETUP.de.md) | [🇪🇸 Español](GOOGLE_DRIVE_SETUP.es.md) | [🇹🇭 ภาษาไทย](GOOGLE_DRIVE_SETUP.th.md) | [🇲🇾 Bahasa Melayu](GOOGLE_DRIVE_SETUP.ms.md) | [🇷🇺 Русский](GOOGLE_DRIVE_SETUP.ru.md) | [🇵🇭 Filipino](GOOGLE_DRIVE_SETUP.fil.md) | [🇧🇷 Português](GOOGLE_DRIVE_SETUP.pt.md)

---

## 步骤 1：创建 Google Cloud 项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 点击右上角的 **"新建项目"**
3. 为您的项目命名：`Marix SSH Client` 或您喜欢的任何名称
4. 点击 **"创建"**

## 步骤 2：启用 Google Drive API

1. 在您新创建的项目中，转到 **"API 和服务"** > **"库"**
2. 搜索 **"Google Drive API"**
3. 点击结果并按 **"启用"**

## 步骤 3：创建 OAuth 2.0 凭据

### 3.1. 配置 OAuth 同意屏幕

1. 转到 **"API 和服务"** > **"OAuth 同意屏幕"**
2. 选择 **"外部"**（允许任何 Google 帐户用户）
3. 点击 **"创建"**

**应用信息：**
- 应用名称：`Marix SSH Client`
- 用户支持电子邮件：`your-email@gmail.com`
- 应用徽标：（可选）
- 应用主页：`https://github.com/marixdev/marix`

**开发者联系信息：**
- 电子邮件地址：`your-email@gmail.com`

4. 点击 **"保存并继续"**

**范围：**
5. 点击 **"添加或删除范围"**
6. 查找并选择：
   - `https://www.googleapis.com/auth/drive.file`
7. 点击 **"更新"** 和 **"保存并继续"**

### 3.2. 创建 OAuth 客户端 ID

1. 转到 **"API 和服务"** > **"凭据"**
2. 点击 **"创建凭据"** > **"OAuth 客户端 ID"**
3. 选择 **"桌面应用"**
4. 命名：`Marix Desktop Client`
5. 点击 **"创建"**

6. **下载 JSON 文件**：点击下载图标
7. **用于本地开发**：在 `src/main/services/` 中创建 `google-credentials.json`：
```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "YOUR_CLIENT_SECRET"
  }
}
```

8. **用于 CI/CD 构建**：使用 GitHub Secrets（见下文）

## 步骤 4：在 Marix 中配置

### 选项 A：本地开发

1. 将 `google-credentials.json` 文件复制到 `src/main/services/` 文件夹
2. **重要**：添加到 `.gitignore`：
```
src/main/services/google-credentials.json
```

### 选项 B：使用 GitHub Secrets 的 CI/CD（推荐）

1. 转到您的 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions**
2. 添加这些 secrets：
   - `GOOGLE_CLIENT_ID`：您的 OAuth 客户端 ID
   - `GOOGLE_CLIENT_SECRET`：您的 OAuth 客户端密钥
3. 构建工作流将在构建期间自动注入凭据

## 步骤 5：测试 OAuth 流程

1. 打开 Marix 应用
2. 转到 **设置** > **备份和恢复**
3. 选择 **"Google Drive"** 标签
4. 点击 **"连接到 Google Drive"**
5. 浏览器将打开 Google OAuth 屏幕
6. 选择您的 Google 帐户并授予权限
7. 应用将收到令牌并显示"已连接"

## 安全说明

- **不要**将 `google-credentials.json` 提交到 Git
- 使用 **GitHub Secrets** 进行 CI/CD 构建以保护 client_secret
- 刷新令牌存储在 Electron store 中（已加密）
- 使用 PKCE 实现额外的 OAuth 安全性

## 发布应用（必需）

1. 转到 **OAuth 同意屏幕**
2. 点击 **"发布应用"**
3. 您的应用将立即获得批准
4. 任何人都可以使用它而不会收到"未经验证的应用"警告

## 故障排除

### 错误："Access blocked: This app's request is invalid"
- 检查 OAuth 同意屏幕是否已完全配置

### 错误："The OAuth client was not found"
- 验证凭据文件中的客户端 ID
- 从 Google Cloud Console 重新下载 JSON 文件

### 错误："Access denied"
- 用户拒绝授予权限
