<p align="center">
  <img src="icon/icon.png" alt="Marix Logo" width="128" height="128">
</p>

<h1 align="center">Marix</h1>

<p align="center">
  <strong>Modern SSH/SFTP/FTP/RDP Client</strong>
</p>

<p align="center">
  <a href="#-english">English</a> •
  <a href="#-tiếng-việt">Tiếng Việt</a> •
  <a href="#-bahasa-indonesia">Bahasa Indonesia</a> •
  <a href="#-中文">中文</a> •
  <a href="#-한국어">한국어</a> •
  <a href="#-日本語">日本語</a> •
  <a href="#-français">Français</a> •
  <a href="#-deutsch">Deutsch</a> •
  <a href="#-español">Español</a> •
  <a href="#-ภาษาไทย">ภาษาไทย</a> •
  <a href="#-bahasa-melayu">Bahasa Melayu</a> •
  <a href="#-русский">Русский</a> •
  <a href="#-filipino">Filipino</a> •
  <a href="#-português">Português</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Platform">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/electron-39.x-9feaf9" alt="Electron">
  <img src="https://img.shields.io/badge/react-19.x-61dafb" alt="React">
  <img src="https://img.shields.io/badge/typescript-5.x-3178c6" alt="TypeScript">
</p>

---

## 🇺🇸 English

### Overview

**Marix** is a modern, cross-platform SSH/SFTP/FTP/RDP client built with ElectronJS. It provides a sleek, intuitive interface for managing multiple server connections with integrated terminal emulation and file transfer capabilities.

### Features

#### 🔐 Multi-Protocol Support
- **SSH** - Secure Shell connections with password and private key authentication
- **SFTP** - Secure File Transfer Protocol with dual-pane file manager
- **FTP** - File Transfer Protocol support
- **RDP** - Remote Desktop Protocol for Windows servers (xfreerdp3 on Linux, mstsc on Windows)

#### 💻 Terminal
- Full-featured terminal emulation powered by **xterm.js**
- Support for 200+ terminal color themes
- Customizable font family and size
- Copy/paste support
- Dynamic terminal resizing

#### 📁 SFTP File Manager
- Dual-pane interface for easy file management
- Upload/download files and folders
- Create, rename, delete files and directories
- Drag-and-drop support
- Permission management (chmod)
- Integrated text editor with syntax highlighting (CodeMirror)

#### 🖥️ Remote Desktop (RDP)
- Connect to Windows servers via RDP
- Full-screen and windowed modes
- Clipboard sharing
- Cross-platform: Uses `mstsc` on Windows, `xfreerdp3` on Linux

#### 🛠️ Additional Tools
- **Cloudflare DNS Manager** - Manage DNS records via Cloudflare API
- **WHOIS Lookup** - Domain information lookup
- **SSH Key Manager** - Generate and manage SSH key pairs
- **Known Hosts Manager** - View and manage SSH known hosts

#### 🎨 User Experience
- Dark and Light theme support
- 14 language translations
- Server tagging and color coding
- Connection history
- Secure credential storage with Argon2id encryption
- Backup/Restore functionality

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Windows 10, macOS 10.15, Ubuntu 20.04 | Latest versions |
| RAM | 4 GB | 8 GB |
| Storage | 200 MB | 500 MB |
| Node.js | 18.x | 20.x LTS |

#### Platform-Specific Dependencies

**Linux (for RDP):**
```bash
# Ubuntu/Debian
sudo apt install freerdp3-x11 xdotool

# Fedora
sudo dnf install freerdp xdotool

# Arch
sudo pacman -S freerdp xdotool
```

**Windows:**
- RDP: Built-in `mstsc.exe` (no additional installation required)

### Installation

```bash
# Clone the repository
git clone https://github.com/user/marix.git
cd marix

# Install dependencies
npm install

# Build the application
npm run build

# Run the application
npm start
```

### Development

```bash
# Run in development mode with hot reload
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package
```

### Project Structure

```
marix/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # Main entry point
│   │   └── services/         # Backend services
│   │       ├── SSHConnectionManager.ts
│   │       ├── NativeSSHManager.ts
│   │       ├── SFTPManager.ts
│   │       ├── FTPManager.ts
│   │       ├── RDPManager.ts
│   │       └── ...
│   └── renderer/             # React frontend
│       ├── components/       # React components
│       ├── contexts/         # React contexts
│       ├── locales/          # i18n translations
│       └── styles/           # CSS styles
├── public/                   # Static assets
├── theme/                    # Terminal themes
└── icon/                     # Application icons
```

### Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Electron 39.x |
| Frontend | React 19.x, TypeScript 5.x |
| Styling | Tailwind CSS 4.x |
| Terminal | xterm.js 6.x |
| SSH/SFTP | ssh2, node-pty |
| FTP | basic-ftp |
| Editor | CodeMirror 6.x |
| Encryption | Argon2 |
| Storage | electron-store |

### License

This project is licensed under the MIT License.

---

## 🇻🇳 Tiếng Việt

### Tổng Quan

**Marix** là ứng dụng SSH/SFTP/FTP/RDP client hiện đại, đa nền tảng được xây dựng bằng ElectronJS. Ứng dụng cung cấp giao diện đẹp mắt, trực quan để quản lý nhiều kết nối server với tính năng giả lập terminal và truyền file tích hợp.

### Tính Năng

#### 🔐 Hỗ Trợ Đa Giao Thức
- **SSH** - Kết nối Secure Shell với xác thực mật khẩu và khóa riêng
- **SFTP** - Giao thức truyền file an toàn với trình quản lý file hai ngăn
- **FTP** - Hỗ trợ giao thức truyền file FTP
- **RDP** - Remote Desktop Protocol cho máy chủ Windows (xfreerdp3 trên Linux, mstsc trên Windows)

#### 💻 Terminal
- Giả lập terminal đầy đủ tính năng bằng **xterm.js**
- Hỗ trợ hơn 200 theme màu terminal
- Tùy chỉnh font chữ và kích thước
- Hỗ trợ copy/paste
- Tự động điều chỉnh kích thước terminal

#### 📁 Trình Quản Lý File SFTP
- Giao diện hai ngăn để quản lý file dễ dàng
- Upload/download file và thư mục
- Tạo, đổi tên, xóa file và thư mục
- Hỗ trợ kéo thả
- Quản lý quyền (chmod)
- Trình soạn thảo văn bản tích hợp với highlight cú pháp (CodeMirror)

#### 🖥️ Remote Desktop (RDP)
- Kết nối tới máy chủ Windows qua RDP
- Chế độ toàn màn hình và cửa sổ
- Chia sẻ clipboard
- Đa nền tảng: Sử dụng `mstsc` trên Windows, `xfreerdp3` trên Linux

#### 🛠️ Công Cụ Bổ Sung
- **Quản lý DNS Cloudflare** - Quản lý bản ghi DNS qua Cloudflare API
- **Tra cứu WHOIS** - Tra cứu thông tin tên miền
- **Quản lý SSH Key** - Tạo và quản lý cặp khóa SSH
- **Quản lý Known Hosts** - Xem và quản lý SSH known hosts

#### 🎨 Trải Nghiệm Người Dùng
- Hỗ trợ giao diện Sáng và Tối
- Dịch 14 ngôn ngữ
- Gắn tag và mã màu cho server
- Lịch sử kết nối
- Lưu trữ thông tin đăng nhập an toàn với mã hóa Argon2id
- Chức năng Sao lưu/Khôi phục

### Yêu Cầu Hệ Thống

| Thành Phần | Tối Thiểu | Khuyến Nghị |
|------------|-----------|-------------|
| HĐH | Windows 10, macOS 10.15, Ubuntu 20.04 | Phiên bản mới nhất |
| RAM | 4 GB | 8 GB |
| Bộ nhớ | 200 MB | 500 MB |
| Node.js | 18.x | 20.x LTS |

### Cài Đặt

```bash
# Clone repository
git clone https://github.com/user/marix.git
cd marix

# Cài đặt dependencies
npm install

# Build ứng dụng
npm run build

# Chạy ứng dụng
npm start
```

### Giấy Phép

Dự án này được cấp phép theo Giấy phép MIT.

---

## 🇮🇩 Bahasa Indonesia

### Ikhtisar

**Marix** adalah klien SSH/SFTP/FTP/RDP modern dan lintas platform yang dibangun dengan ElectronJS. Aplikasi ini menyediakan antarmuka yang elegan dan intuitif untuk mengelola beberapa koneksi server dengan emulasi terminal terintegrasi dan kemampuan transfer file.

### Fitur

#### 🔐 Dukungan Multi-Protokol
- **SSH** - Koneksi Secure Shell dengan autentikasi kata sandi dan kunci privat
- **SFTP** - Protokol Transfer File Aman dengan pengelola file panel ganda
- **FTP** - Dukungan Protokol Transfer File
- **RDP** - Remote Desktop Protocol untuk server Windows (xfreerdp3 di Linux, mstsc di Windows)

#### 💻 Terminal
- Emulasi terminal lengkap menggunakan **xterm.js**
- Dukungan untuk 200+ tema warna terminal
- Font dan ukuran yang dapat disesuaikan
- Dukungan salin/tempel
- Pengubahan ukuran terminal dinamis

#### 📁 Pengelola File SFTP
- Antarmuka panel ganda untuk manajemen file yang mudah
- Unggah/unduh file dan folder
- Buat, ganti nama, hapus file dan direktori
- Dukungan seret dan lepas
- Manajemen izin (chmod)
- Editor teks terintegrasi dengan penyorotan sintaks (CodeMirror)

#### 🖥️ Remote Desktop (RDP)
- Terhubung ke server Windows melalui RDP
- Mode layar penuh dan berjendela
- Berbagi papan klip
- Lintas platform: Menggunakan `mstsc` di Windows, `xfreerdp3` di Linux

#### 🛠️ Alat Tambahan
- **Manajer DNS Cloudflare** - Kelola catatan DNS melalui Cloudflare API
- **Pencarian WHOIS** - Pencarian informasi domain
- **Manajer Kunci SSH** - Buat dan kelola pasangan kunci SSH
- **Manajer Known Hosts** - Lihat dan kelola SSH known hosts

#### 🎨 Pengalaman Pengguna
- Dukungan tema Gelap dan Terang
- Terjemahan 14 bahasa
- Penandaan dan pengkodean warna server
- Riwayat koneksi
- Penyimpanan kredensial aman dengan enkripsi Argon2id
- Fungsi Cadangan/Pulihkan

### Persyaratan Sistem

| Komponen | Minimum | Direkomendasikan |
|----------|---------|------------------|
| OS | Windows 10, macOS 10.15, Ubuntu 20.04 | Versi terbaru |
| RAM | 4 GB | 8 GB |
| Penyimpanan | 200 MB | 500 MB |
| Node.js | 18.x | 20.x LTS |

### Instalasi

```bash
# Clone repositori
git clone https://github.com/user/marix.git
cd marix

# Instal dependensi
npm install

# Bangun aplikasi
npm run build

# Jalankan aplikasi
npm start
```

### Lisensi

Proyek ini dilisensikan di bawah Lisensi MIT.

---

## 🇨🇳 中文

### 概述

**Marix** 是一款使用 ElectronJS 构建的现代化、跨平台 SSH/SFTP/FTP/RDP 客户端。它提供了简洁直观的界面，用于管理多个服务器连接，并集成了终端模拟和文件传输功能。

### 功能特性

#### 🔐 多协议支持
- **SSH** - 支持密码和私钥认证的安全外壳连接
- **SFTP** - 带双面板文件管理器的安全文件传输协议
- **FTP** - 文件传输协议支持
- **RDP** - 用于 Windows 服务器的远程桌面协议（Linux 上使用 xfreerdp3，Windows 上使用 mstsc）

#### 💻 终端
- 由 **xterm.js** 提供支持的全功能终端模拟
- 支持 200 多种终端配色主题
- 可自定义字体和大小
- 支持复制/粘贴
- 动态终端大小调整

#### 📁 SFTP 文件管理器
- 双面板界面，便于文件管理
- 上传/下载文件和文件夹
- 创建、重命名、删除文件和目录
- 支持拖放
- 权限管理（chmod）
- 集成的文本编辑器，支持语法高亮（CodeMirror）

#### 🖥️ 远程桌面（RDP）
- 通过 RDP 连接到 Windows 服务器
- 全屏和窗口模式
- 剪贴板共享
- 跨平台：Windows 上使用 `mstsc`，Linux 上使用 `xfreerdp3`

#### 🛠️ 附加工具
- **Cloudflare DNS 管理器** - 通过 Cloudflare API 管理 DNS 记录
- **WHOIS 查询** - 域名信息查询
- **SSH 密钥管理器** - 生成和管理 SSH 密钥对
- **Known Hosts 管理器** - 查看和管理 SSH known hosts

#### 🎨 用户体验
- 支持深色和浅色主题
- 14 种语言翻译
- 服务器标签和颜色编码
- 连接历史记录
- 使用 Argon2id 加密的安全凭据存储
- 备份/恢复功能

### 系统要求

| 组件 | 最低配置 | 推荐配置 |
|------|----------|----------|
| 操作系统 | Windows 10, macOS 10.15, Ubuntu 20.04 | 最新版本 |
| 内存 | 4 GB | 8 GB |
| 存储 | 200 MB | 500 MB |
| Node.js | 18.x | 20.x LTS |

### 安装

```bash
# 克隆仓库
git clone https://github.com/user/marix.git
cd marix

# 安装依赖
npm install

# 构建应用
npm run build

# 运行应用
npm start
```

### 许可证

本项目采用 MIT 许可证。

---

## 🇰🇷 한국어

### 개요

**Marix**는 ElectronJS로 구축된 현대적인 크로스 플랫폼 SSH/SFTP/FTP/RDP 클라이언트입니다. 통합 터미널 에뮬레이션과 파일 전송 기능을 갖춘 세련되고 직관적인 인터페이스로 여러 서버 연결을 관리할 수 있습니다.

### 기능

#### 🔐 다중 프로토콜 지원
- **SSH** - 비밀번호 및 개인 키 인증을 지원하는 보안 셸 연결
- **SFTP** - 듀얼 패널 파일 관리자가 포함된 보안 파일 전송 프로토콜
- **FTP** - 파일 전송 프로토콜 지원
- **RDP** - Windows 서버용 원격 데스크톱 프로토콜 (Linux에서는 xfreerdp3, Windows에서는 mstsc)

#### 💻 터미널
- **xterm.js**로 구동되는 완전한 기능의 터미널 에뮬레이션
- 200개 이상의 터미널 색상 테마 지원
- 사용자 정의 가능한 글꼴 및 크기
- 복사/붙여넣기 지원
- 동적 터미널 크기 조정

#### 📁 SFTP 파일 관리자
- 쉬운 파일 관리를 위한 듀얼 패널 인터페이스
- 파일 및 폴더 업로드/다운로드
- 파일 및 디렉터리 생성, 이름 변경, 삭제
- 드래그 앤 드롭 지원
- 권한 관리 (chmod)
- 구문 강조 기능이 있는 통합 텍스트 편집기 (CodeMirror)

#### 🖥️ 원격 데스크톱 (RDP)
- RDP를 통해 Windows 서버에 연결
- 전체 화면 및 창 모드
- 클립보드 공유
- 크로스 플랫폼: Windows에서는 `mstsc`, Linux에서는 `xfreerdp3` 사용

#### 🛠️ 추가 도구
- **Cloudflare DNS 관리자** - Cloudflare API를 통한 DNS 레코드 관리
- **WHOIS 조회** - 도메인 정보 조회
- **SSH 키 관리자** - SSH 키 쌍 생성 및 관리
- **Known Hosts 관리자** - SSH known hosts 보기 및 관리

#### 🎨 사용자 경험
- 다크 및 라이트 테마 지원
- 14개 언어 번역
- 서버 태깅 및 색상 코딩
- 연결 기록
- Argon2id 암호화를 통한 안전한 자격 증명 저장
- 백업/복원 기능

### 시스템 요구 사항

| 구성 요소 | 최소 | 권장 |
|-----------|------|------|
| OS | Windows 10, macOS 10.15, Ubuntu 20.04 | 최신 버전 |
| RAM | 4 GB | 8 GB |
| 저장 공간 | 200 MB | 500 MB |
| Node.js | 18.x | 20.x LTS |

### 설치

```bash
# 저장소 복제
git clone https://github.com/user/marix.git
cd marix

# 종속성 설치
npm install

# 애플리케이션 빌드
npm run build

# 애플리케이션 실행
npm start
```

### 라이선스

이 프로젝트는 MIT 라이선스에 따라 라이선스가 부여됩니다.

---

## 🇯🇵 日本語

### 概要

**Marix**は、ElectronJSで構築されたモダンなクロスプラットフォームSSH/SFTP/FTP/RDPクライアントです。統合されたターミナルエミュレーションとファイル転送機能を備えた、洗練された直感的なインターフェースで複数のサーバー接続を管理できます。

### 機能

#### 🔐 マルチプロトコルサポート
- **SSH** - パスワードと秘密鍵認証をサポートするセキュアシェル接続
- **SFTP** - デュアルペインファイルマネージャーを備えたセキュアファイル転送プロトコル
- **FTP** - ファイル転送プロトコルサポート
- **RDP** - Windowsサーバー用リモートデスクトッププロトコル（LinuxではxFreeRDP3、WindowsではMSTSC）

#### 💻 ターミナル
- **xterm.js**によるフル機能のターミナルエミュレーション
- 200以上のターミナルカラーテーマをサポート
- カスタマイズ可能なフォントファミリーとサイズ
- コピー/ペーストサポート
- 動的なターミナルリサイズ

#### 📁 SFTPファイルマネージャー
- 簡単なファイル管理のためのデュアルペインインターフェース
- ファイルとフォルダーのアップロード/ダウンロード
- ファイルとディレクトリの作成、名前変更、削除
- ドラッグアンドドロップサポート
- パーミッション管理（chmod）
- シンタックスハイライト付き統合テキストエディター（CodeMirror）

#### 🖥️ リモートデスクトップ（RDP）
- RDP経由でWindowsサーバーに接続
- フルスクリーンとウィンドウモード
- クリップボード共有
- クロスプラットフォーム：Windowsでは`mstsc`、Linuxでは`xfreerdp3`を使用

#### 🛠️ 追加ツール
- **Cloudflare DNSマネージャー** - Cloudflare APIによるDNSレコード管理
- **WHOIS検索** - ドメイン情報検索
- **SSH鍵マネージャー** - SSH鍵ペアの生成と管理
- **Known Hostsマネージャー** - SSH known hostsの表示と管理

#### 🎨 ユーザーエクスペリエンス
- ダークとライトテーマのサポート
- 14言語の翻訳
- サーバーのタグ付けとカラーコーディング
- 接続履歴
- Argon2id暗号化による安全な認証情報保存
- バックアップ/リストア機能

### システム要件

| コンポーネント | 最小 | 推奨 |
|----------------|------|------|
| OS | Windows 10, macOS 10.15, Ubuntu 20.04 | 最新バージョン |
| RAM | 4 GB | 8 GB |
| ストレージ | 200 MB | 500 MB |
| Node.js | 18.x | 20.x LTS |

### インストール

```bash
# リポジトリをクローン
git clone https://github.com/user/marix.git
cd marix

# 依存関係をインストール
npm install

# アプリケーションをビルド
npm run build

# アプリケーションを実行
npm start
```

### ライセンス

このプロジェクトはMITライセンスの下でライセンスされています。

---

## 🇫🇷 Français

### Aperçu

**Marix** est un client SSH/SFTP/FTP/RDP moderne et multiplateforme construit avec ElectronJS. Il offre une interface élégante et intuitive pour gérer plusieurs connexions serveur avec une émulation de terminal intégrée et des capacités de transfert de fichiers.

### Fonctionnalités

#### 🔐 Support Multi-Protocoles
- **SSH** - Connexions Secure Shell avec authentification par mot de passe et clé privée
- **SFTP** - Protocole de transfert de fichiers sécurisé avec gestionnaire de fichiers à double panneau
- **FTP** - Support du protocole de transfert de fichiers
- **RDP** - Protocole de bureau à distance pour les serveurs Windows (xfreerdp3 sur Linux, mstsc sur Windows)

#### 💻 Terminal
- Émulation de terminal complète propulsée par **xterm.js**
- Support de plus de 200 thèmes de couleurs de terminal
- Police et taille personnalisables
- Support du copier/coller
- Redimensionnement dynamique du terminal

#### 📁 Gestionnaire de Fichiers SFTP
- Interface à double panneau pour une gestion facile des fichiers
- Téléversement/téléchargement de fichiers et dossiers
- Créer, renommer, supprimer des fichiers et répertoires
- Support du glisser-déposer
- Gestion des permissions (chmod)
- Éditeur de texte intégré avec coloration syntaxique (CodeMirror)

#### 🖥️ Bureau à Distance (RDP)
- Connexion aux serveurs Windows via RDP
- Modes plein écran et fenêtré
- Partage du presse-papiers
- Multiplateforme : utilise `mstsc` sur Windows, `xfreerdp3` sur Linux

#### 🛠️ Outils Supplémentaires
- **Gestionnaire DNS Cloudflare** - Gérer les enregistrements DNS via l'API Cloudflare
- **Recherche WHOIS** - Recherche d'informations sur les domaines
- **Gestionnaire de Clés SSH** - Générer et gérer les paires de clés SSH
- **Gestionnaire Known Hosts** - Voir et gérer les SSH known hosts

#### 🎨 Expérience Utilisateur
- Support des thèmes sombre et clair
- Traductions en 14 langues
- Étiquetage et codage couleur des serveurs
- Historique des connexions
- Stockage sécurisé des identifiants avec chiffrement Argon2id
- Fonctionnalité de sauvegarde/restauration

### Configuration Requise

| Composant | Minimum | Recommandé |
|-----------|---------|------------|
| OS | Windows 10, macOS 10.15, Ubuntu 20.04 | Dernières versions |
| RAM | 4 Go | 8 Go |
| Stockage | 200 Mo | 500 Mo |
| Node.js | 18.x | 20.x LTS |

### Installation

```bash
# Cloner le dépôt
git clone https://github.com/user/marix.git
cd marix

# Installer les dépendances
npm install

# Construire l'application
npm run build

# Exécuter l'application
npm start
```

### Licence

Ce projet est sous licence MIT.

---

## 🇩🇪 Deutsch

### Übersicht

**Marix** ist ein moderner, plattformübergreifender SSH/SFTP/FTP/RDP-Client, der mit ElectronJS erstellt wurde. Er bietet eine elegante, intuitive Oberfläche zur Verwaltung mehrerer Serververbindungen mit integrierter Terminalemulation und Dateiübertragungsfunktionen.

### Funktionen

#### 🔐 Multi-Protokoll-Unterstützung
- **SSH** - Secure Shell-Verbindungen mit Passwort- und Private-Key-Authentifizierung
- **SFTP** - Sicheres Dateiübertragungsprotokoll mit Zwei-Fenster-Dateimanager
- **FTP** - Unterstützung des Dateiübertragungsprotokolls
- **RDP** - Remote Desktop Protocol für Windows-Server (xfreerdp3 unter Linux, mstsc unter Windows)

#### 💻 Terminal
- Voll ausgestattete Terminalemulation mit **xterm.js**
- Unterstützung von über 200 Terminal-Farbthemen
- Anpassbare Schriftart und -größe
- Kopieren/Einfügen-Unterstützung
- Dynamische Terminalgrößenanpassung

#### 📁 SFTP-Dateimanager
- Zwei-Fenster-Oberfläche für einfache Dateiverwaltung
- Hoch-/Herunterladen von Dateien und Ordnern
- Erstellen, Umbenennen, Löschen von Dateien und Verzeichnissen
- Drag-and-Drop-Unterstützung
- Berechtigungsverwaltung (chmod)
- Integrierter Texteditor mit Syntaxhervorhebung (CodeMirror)

#### 🖥️ Remote Desktop (RDP)
- Verbindung zu Windows-Servern über RDP
- Vollbild- und Fenstermodus
- Zwischenablage-Freigabe
- Plattformübergreifend: Verwendet `mstsc` unter Windows, `xfreerdp3` unter Linux

#### 🛠️ Zusätzliche Werkzeuge
- **Cloudflare DNS-Manager** - DNS-Einträge über Cloudflare API verwalten
- **WHOIS-Abfrage** - Domain-Informationsabfrage
- **SSH-Schlüssel-Manager** - SSH-Schlüsselpaare generieren und verwalten
- **Known Hosts-Manager** - SSH Known Hosts anzeigen und verwalten

#### 🎨 Benutzererfahrung
- Unterstützung für dunkles und helles Theme
- Übersetzungen in 14 Sprachen
- Server-Tagging und Farbcodierung
- Verbindungsverlauf
- Sichere Anmeldedatenspeicherung mit Argon2id-Verschlüsselung
- Backup/Wiederherstellungsfunktion

### Systemanforderungen

| Komponente | Minimum | Empfohlen |
|------------|---------|-----------|
| BS | Windows 10, macOS 10.15, Ubuntu 20.04 | Neueste Versionen |
| RAM | 4 GB | 8 GB |
| Speicher | 200 MB | 500 MB |
| Node.js | 18.x | 20.x LTS |

### Installation

```bash
# Repository klonen
git clone https://github.com/user/marix.git
cd marix

# Abhängigkeiten installieren
npm install

# Anwendung erstellen
npm run build

# Anwendung ausführen
npm start
```

### Lizenz

Dieses Projekt ist unter der MIT-Lizenz lizenziert.

---

## 🇪🇸 Español

### Descripción General

**Marix** es un cliente SSH/SFTP/FTP/RDP moderno y multiplataforma construido con ElectronJS. Proporciona una interfaz elegante e intuitiva para gestionar múltiples conexiones de servidor con emulación de terminal integrada y capacidades de transferencia de archivos.

### Características

#### 🔐 Soporte Multi-Protocolo
- **SSH** - Conexiones Secure Shell con autenticación por contraseña y clave privada
- **SFTP** - Protocolo de transferencia de archivos seguro con gestor de archivos de doble panel
- **FTP** - Soporte de protocolo de transferencia de archivos
- **RDP** - Protocolo de escritorio remoto para servidores Windows (xfreerdp3 en Linux, mstsc en Windows)

#### 💻 Terminal
- Emulación de terminal completa impulsada por **xterm.js**
- Soporte para más de 200 temas de colores de terminal
- Familia de fuentes y tamaño personalizables
- Soporte de copiar/pegar
- Redimensionamiento dinámico del terminal

#### 📁 Gestor de Archivos SFTP
- Interfaz de doble panel para fácil gestión de archivos
- Subir/descargar archivos y carpetas
- Crear, renombrar, eliminar archivos y directorios
- Soporte de arrastrar y soltar
- Gestión de permisos (chmod)
- Editor de texto integrado con resaltado de sintaxis (CodeMirror)

#### 🖥️ Escritorio Remoto (RDP)
- Conectar a servidores Windows vía RDP
- Modos de pantalla completa y ventana
- Compartir portapapeles
- Multiplataforma: usa `mstsc` en Windows, `xfreerdp3` en Linux

#### 🛠️ Herramientas Adicionales
- **Gestor DNS de Cloudflare** - Gestionar registros DNS vía API de Cloudflare
- **Búsqueda WHOIS** - Búsqueda de información de dominio
- **Gestor de Claves SSH** - Generar y gestionar pares de claves SSH
- **Gestor de Known Hosts** - Ver y gestionar SSH known hosts

#### 🎨 Experiencia de Usuario
- Soporte de tema oscuro y claro
- Traducciones en 14 idiomas
- Etiquetado y codificación por colores de servidores
- Historial de conexiones
- Almacenamiento seguro de credenciales con cifrado Argon2id
- Funcionalidad de respaldo/restauración

### Requisitos del Sistema

| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| SO | Windows 10, macOS 10.15, Ubuntu 20.04 | Últimas versiones |
| RAM | 4 GB | 8 GB |
| Almacenamiento | 200 MB | 500 MB |
| Node.js | 18.x | 20.x LTS |

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/user/marix.git
cd marix

# Instalar dependencias
npm install

# Construir la aplicación
npm run build

# Ejecutar la aplicación
npm start
```

### Licencia

Este proyecto está licenciado bajo la Licencia MIT.

---

## 🇹🇭 ภาษาไทย

### ภาพรวม

**Marix** เป็นโปรแกรมไคลเอนต์ SSH/SFTP/FTP/RDP ที่ทันสมัยและข้ามแพลตฟอร์ม สร้างด้วย ElectronJS มีอินเทอร์เฟซที่สวยงามและใช้งานง่ายสำหรับการจัดการการเชื่อมต่อเซิร์ฟเวอร์หลายตัว พร้อมการจำลองเทอร์มินัลและความสามารถในการถ่ายโอนไฟล์แบบบูรณาการ

### คุณสมบัติ

#### 🔐 รองรับหลายโปรโตคอล
- **SSH** - การเชื่อมต่อ Secure Shell พร้อมการยืนยันตัวตนด้วยรหัสผ่านและคีย์ส่วนตัว
- **SFTP** - โปรโตคอลการถ่ายโอนไฟล์แบบปลอดภัยพร้อมตัวจัดการไฟล์แบบสองแผง
- **FTP** - รองรับโปรโตคอลการถ่ายโอนไฟล์
- **RDP** - โปรโตคอลเดสก์ท็อประยะไกลสำหรับเซิร์ฟเวอร์ Windows (xfreerdp3 บน Linux, mstsc บน Windows)

#### 💻 เทอร์มินัล
- การจำลองเทอร์มินัลเต็มรูปแบบโดย **xterm.js**
- รองรับธีมสีเทอร์มินัลมากกว่า 200 แบบ
- ปรับแต่งแบบอักษรและขนาดได้
- รองรับการคัดลอก/วาง
- ปรับขนาดเทอร์มินัลแบบไดนามิก

#### 📁 ตัวจัดการไฟล์ SFTP
- อินเทอร์เฟซแบบสองแผงสำหรับการจัดการไฟล์ที่ง่ายดาย
- อัปโหลด/ดาวน์โหลดไฟล์และโฟลเดอร์
- สร้าง เปลี่ยนชื่อ ลบไฟล์และไดเรกทอรี
- รองรับการลากและวาง
- การจัดการสิทธิ์ (chmod)
- โปรแกรมแก้ไขข้อความในตัวพร้อมการเน้นไวยากรณ์ (CodeMirror)

#### 🖥️ เดสก์ท็อประยะไกล (RDP)
- เชื่อมต่อกับเซิร์ฟเวอร์ Windows ผ่าน RDP
- โหมดเต็มหน้าจอและหน้าต่าง
- แชร์คลิปบอร์ด
- ข้ามแพลตฟอร์ม: ใช้ `mstsc` บน Windows, `xfreerdp3` บน Linux

#### 🛠️ เครื่องมือเพิ่มเติม
- **ตัวจัดการ DNS Cloudflare** - จัดการบันทึก DNS ผ่าน Cloudflare API
- **ค้นหา WHOIS** - ค้นหาข้อมูลโดเมน
- **ตัวจัดการคีย์ SSH** - สร้างและจัดการคู่คีย์ SSH
- **ตัวจัดการ Known Hosts** - ดูและจัดการ SSH known hosts

#### 🎨 ประสบการณ์ผู้ใช้
- รองรับธีมมืดและสว่าง
- แปลเป็น 14 ภาษา
- การติดแท็กและการกำหนดสีเซิร์ฟเวอร์
- ประวัติการเชื่อมต่อ
- การจัดเก็บข้อมูลประจำตัวที่ปลอดภัยด้วยการเข้ารหัส Argon2id
- ฟังก์ชันสำรอง/กู้คืน

### ความต้องการของระบบ

| ส่วนประกอบ | ขั้นต่ำ | แนะนำ |
|------------|--------|-------|
| ระบบปฏิบัติการ | Windows 10, macOS 10.15, Ubuntu 20.04 | เวอร์ชันล่าสุด |
| RAM | 4 GB | 8 GB |
| พื้นที่จัดเก็บ | 200 MB | 500 MB |
| Node.js | 18.x | 20.x LTS |

### การติดตั้ง

```bash
# โคลน repository
git clone https://github.com/user/marix.git
cd marix

# ติดตั้ง dependencies
npm install

# สร้างแอปพลิเคชัน
npm run build

# เรียกใช้แอปพลิเคชัน
npm start
```

### ใบอนุญาต

โปรเจกต์นี้ได้รับอนุญาตภายใต้ใบอนุญาต MIT

---

## 🇲🇾 Bahasa Melayu

### Gambaran Keseluruhan

**Marix** ialah klien SSH/SFTP/FTP/RDP moden dan merentas platform yang dibina dengan ElectronJS. Ia menyediakan antara muka yang anggun dan intuitif untuk mengurus berbilang sambungan pelayan dengan emulasi terminal bersepadu dan keupayaan pemindahan fail.

### Ciri-ciri

#### 🔐 Sokongan Berbilang Protokol
- **SSH** - Sambungan Secure Shell dengan pengesahan kata laluan dan kunci persendirian
- **SFTP** - Protokol Pemindahan Fail Selamat dengan pengurus fail dwi-panel
- **FTP** - Sokongan Protokol Pemindahan Fail
- **RDP** - Protokol Desktop Jauh untuk pelayan Windows (xfreerdp3 di Linux, mstsc di Windows)

#### 💻 Terminal
- Emulasi terminal lengkap dikuasakan oleh **xterm.js**
- Sokongan untuk 200+ tema warna terminal
- Keluarga fon dan saiz boleh disesuaikan
- Sokongan salin/tampal
- Saiz semula terminal dinamik

#### 📁 Pengurus Fail SFTP
- Antara muka dwi-panel untuk pengurusan fail mudah
- Muat naik/muat turun fail dan folder
- Cipta, namakan semula, padam fail dan direktori
- Sokongan seret dan lepas
- Pengurusan kebenaran (chmod)
- Editor teks bersepadu dengan penyerlahan sintaks (CodeMirror)

#### 🖥️ Desktop Jauh (RDP)
- Sambung ke pelayan Windows melalui RDP
- Mod skrin penuh dan tetingkap
- Perkongsian papan keratan
- Merentas platform: Menggunakan `mstsc` di Windows, `xfreerdp3` di Linux

#### 🛠️ Alat Tambahan
- **Pengurus DNS Cloudflare** - Urus rekod DNS melalui API Cloudflare
- **Carian WHOIS** - Carian maklumat domain
- **Pengurus Kunci SSH** - Jana dan urus pasangan kunci SSH
- **Pengurus Known Hosts** - Lihat dan urus SSH known hosts

#### 🎨 Pengalaman Pengguna
- Sokongan tema gelap dan cerah
- Terjemahan 14 bahasa
- Penandaan dan pengekodan warna pelayan
- Sejarah sambungan
- Storan kelayakan selamat dengan penyulitan Argon2id
- Fungsi sandaran/pulihkan

### Keperluan Sistem

| Komponen | Minimum | Disyorkan |
|----------|---------|-----------|
| OS | Windows 10, macOS 10.15, Ubuntu 20.04 | Versi terkini |
| RAM | 4 GB | 8 GB |
| Storan | 200 MB | 500 MB |
| Node.js | 18.x | 20.x LTS |

### Pemasangan

```bash
# Klon repositori
git clone https://github.com/user/marix.git
cd marix

# Pasang kebergantungan
npm install

# Bina aplikasi
npm run build

# Jalankan aplikasi
npm start
```

### Lesen

Projek ini dilesenkan di bawah Lesen MIT.

---

## 🇷🇺 Русский

### Обзор

**Marix** — это современный кроссплатформенный SSH/SFTP/FTP/RDP клиент, созданный на ElectronJS. Он предоставляет элегантный, интуитивно понятный интерфейс для управления несколькими серверными подключениями с интегрированной эмуляцией терминала и возможностями передачи файлов.

### Возможности

#### 🔐 Поддержка нескольких протоколов
- **SSH** — подключения Secure Shell с аутентификацией по паролю и приватному ключу
- **SFTP** — протокол безопасной передачи файлов с двухпанельным файловым менеджером
- **FTP** — поддержка протокола передачи файлов
- **RDP** — протокол удалённого рабочего стола для Windows-серверов (xfreerdp3 в Linux, mstsc в Windows)

#### 💻 Терминал
- Полнофункциональная эмуляция терминала на основе **xterm.js**
- Поддержка более 200 цветовых тем терминала
- Настраиваемый шрифт и размер
- Поддержка копирования/вставки
- Динамическое изменение размера терминала

#### 📁 Файловый менеджер SFTP
- Двухпанельный интерфейс для удобного управления файлами
- Загрузка/скачивание файлов и папок
- Создание, переименование, удаление файлов и директорий
- Поддержка перетаскивания
- Управление правами (chmod)
- Встроенный текстовый редактор с подсветкой синтаксиса (CodeMirror)

#### 🖥️ Удалённый рабочий стол (RDP)
- Подключение к Windows-серверам через RDP
- Полноэкранный и оконный режимы
- Общий буфер обмена
- Кроссплатформенность: использует `mstsc` в Windows, `xfreerdp3` в Linux

#### 🛠️ Дополнительные инструменты
- **Менеджер DNS Cloudflare** — управление DNS-записями через Cloudflare API
- **WHOIS-поиск** — поиск информации о домене
- **Менеджер SSH-ключей** — генерация и управление парами SSH-ключей
- **Менеджер Known Hosts** — просмотр и управление SSH known hosts

#### 🎨 Пользовательский опыт
- Поддержка тёмной и светлой темы
- Перевод на 14 языков
- Теги и цветовое кодирование серверов
- История подключений
- Безопасное хранение учётных данных с шифрованием Argon2id
- Функция резервного копирования/восстановления

### Системные требования

| Компонент | Минимум | Рекомендуемо |
|-----------|---------|--------------|
| ОС | Windows 10, macOS 10.15, Ubuntu 20.04 | Последние версии |
| ОЗУ | 4 ГБ | 8 ГБ |
| Хранилище | 200 МБ | 500 МБ |
| Node.js | 18.x | 20.x LTS |

### Установка

```bash
# Клонировать репозиторий
git clone https://github.com/user/marix.git
cd marix

# Установить зависимости
npm install

# Собрать приложение
npm run build

# Запустить приложение
npm start
```

### Лицензия

Этот проект лицензирован под лицензией MIT.

---

## 🇵🇭 Filipino

### Pangkalahatang-ideya

Ang **Marix** ay isang moderno, cross-platform na SSH/SFTP/FTP/RDP client na ginawa gamit ang ElectronJS. Nagbibigay ito ng makinis at intuitive na interface para sa pamamahala ng maraming server connection na may integrated terminal emulation at file transfer capabilities.

### Mga Tampok

#### 🔐 Multi-Protocol Support
- **SSH** - Secure Shell connections na may password at private key authentication
- **SFTP** - Secure File Transfer Protocol na may dual-pane file manager
- **FTP** - File Transfer Protocol support
- **RDP** - Remote Desktop Protocol para sa Windows servers (xfreerdp3 sa Linux, mstsc sa Windows)

#### 💻 Terminal
- Full-featured terminal emulation na pinapatakbo ng **xterm.js**
- Suporta para sa 200+ terminal color themes
- Customizable na font family at size
- Copy/paste support
- Dynamic terminal resizing

#### 📁 SFTP File Manager
- Dual-pane interface para sa madaling file management
- Upload/download ng files at folders
- Gumawa, palitan ang pangalan, burahin ang files at directories
- Drag-and-drop support
- Permission management (chmod)
- Integrated text editor na may syntax highlighting (CodeMirror)

#### 🖥️ Remote Desktop (RDP)
- Kumonekta sa Windows servers via RDP
- Full-screen at windowed modes
- Clipboard sharing
- Cross-platform: Gumagamit ng `mstsc` sa Windows, `xfreerdp3` sa Linux

#### 🛠️ Karagdagang Mga Tool
- **Cloudflare DNS Manager** - Pamahalaan ang DNS records via Cloudflare API
- **WHOIS Lookup** - Domain information lookup
- **SSH Key Manager** - Gumawa at pamahalaan ang SSH key pairs
- **Known Hosts Manager** - Tingnan at pamahalaan ang SSH known hosts

#### 🎨 User Experience
- Dark at Light theme support
- 14 na wika ang translation
- Server tagging at color coding
- Connection history
- Secure credential storage na may Argon2id encryption
- Backup/Restore functionality

### Mga Kinakailangan ng Sistema

| Component | Minimum | Inirerekomenda |
|-----------|---------|----------------|
| OS | Windows 10, macOS 10.15, Ubuntu 20.04 | Pinakabagong bersyon |
| RAM | 4 GB | 8 GB |
| Storage | 200 MB | 500 MB |
| Node.js | 18.x | 20.x LTS |

### Pag-install

```bash
# I-clone ang repository
git clone https://github.com/user/marix.git
cd marix

# I-install ang dependencies
npm install

# I-build ang application
npm run build

# Patakbuhin ang application
npm start
```

### Lisensya

Ang proyektong ito ay lisensyado sa ilalim ng MIT License.

---

## 🇧🇷 Português

### Visão Geral

**Marix** é um cliente SSH/SFTP/FTP/RDP moderno e multiplataforma construído com ElectronJS. Ele fornece uma interface elegante e intuitiva para gerenciar múltiplas conexões de servidor com emulação de terminal integrada e capacidades de transferência de arquivos.

### Recursos

#### 🔐 Suporte Multi-Protocolo
- **SSH** - Conexões Secure Shell com autenticação por senha e chave privada
- **SFTP** - Protocolo de Transferência de Arquivos Seguro com gerenciador de arquivos de painel duplo
- **FTP** - Suporte ao Protocolo de Transferência de Arquivos
- **RDP** - Protocolo de Área de Trabalho Remota para servidores Windows (xfreerdp3 no Linux, mstsc no Windows)

#### 💻 Terminal
- Emulação de terminal completa alimentada por **xterm.js**
- Suporte para mais de 200 temas de cores de terminal
- Família de fontes e tamanho personalizáveis
- Suporte a copiar/colar
- Redimensionamento dinâmico do terminal

#### 📁 Gerenciador de Arquivos SFTP
- Interface de painel duplo para fácil gerenciamento de arquivos
- Upload/download de arquivos e pastas
- Criar, renomear, excluir arquivos e diretórios
- Suporte a arrastar e soltar
- Gerenciamento de permissões (chmod)
- Editor de texto integrado com destaque de sintaxe (CodeMirror)

#### 🖥️ Área de Trabalho Remota (RDP)
- Conectar a servidores Windows via RDP
- Modos de tela cheia e janela
- Compartilhamento de área de transferência
- Multiplataforma: usa `mstsc` no Windows, `xfreerdp3` no Linux

#### 🛠️ Ferramentas Adicionais
- **Gerenciador DNS Cloudflare** - Gerenciar registros DNS via API Cloudflare
- **Consulta WHOIS** - Consulta de informações de domínio
- **Gerenciador de Chaves SSH** - Gerar e gerenciar pares de chaves SSH
- **Gerenciador de Known Hosts** - Visualizar e gerenciar SSH known hosts

#### 🎨 Experiência do Usuário
- Suporte a tema escuro e claro
- Traduções em 14 idiomas
- Marcação e codificação por cores de servidores
- Histórico de conexões
- Armazenamento seguro de credenciais com criptografia Argon2id
- Funcionalidade de backup/restauração

### Requisitos do Sistema

| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| SO | Windows 10, macOS 10.15, Ubuntu 20.04 | Versões mais recentes |
| RAM | 4 GB | 8 GB |
| Armazenamento | 200 MB | 500 MB |
| Node.js | 18.x | 20.x LTS |

### Instalação

```bash
# Clonar o repositório
git clone https://github.com/user/marix.git
cd marix

# Instalar dependências
npm install

# Compilar a aplicação
npm run build

# Executar a aplicação
npm start
```

### Licença

Este projeto está licenciado sob a Licença MIT.

---

## 📝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Bug Reports

If you find a bug, please open an issue with detailed information about the bug and how to reproduce it.

## 📧 Contact

For questions and support, please open an issue on GitHub.

---

<p align="center">
  Made with ❤️ by the Marix Team
</p>
