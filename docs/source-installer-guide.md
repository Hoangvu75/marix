# Source Installer Guide

The Source Installer is a powerful feature in Marix that allows you to install popular web frameworks and CMS directly on your remote server via SSH. No more manually running composer or npm commands—just select, configure, and install.

## Overview

The Source Installer supports:

| Category | Frameworks | Version Source |
|----------|------------|----------------|
| **PHP** | Laravel, WordPress, Symfony, CodeIgniter 3/4 | GitHub Releases/Tags |
| **JavaScript** | Express.js, NestJS, Fastify, Vue.js, Nuxt.js, React, Next.js | npm Registry |
| **TypeScript** | TypeScript Node | npm Registry |

## Getting Started

### Prerequisites

Before using the Source Installer, ensure your server has:

- **For PHP frameworks**: PHP and Composer installed
- **For JavaScript frameworks**: Node.js and npm installed
- **SSH access** with appropriate permissions to install packages

### Accessing the Source Installer

1. Connect to your server via SSH
2. Switch to the **SFTP** tab
3. Navigate to the directory where you want to install the framework
4. Right-click and select **"Install Source Code"** from the context menu

![Source Installer Menu](images/source-installer-menu.png)

## Installation Process

### Step 1: Select Framework

Choose from the available frameworks organized by category:

- **PHP Frameworks**: Laravel, WordPress, Symfony, CodeIgniter
- **JavaScript Frameworks**: Express.js, NestJS, Fastify, Vue.js, Nuxt.js, React, Next.js
- **TypeScript**: TypeScript Node

Each framework displays a brief description and required dependencies.

### Step 2: Version Selection

#### PHP Frameworks

For PHP frameworks, the installer:

1. **Detects your server's PHP version** automatically
2. **Fetches available versions** from GitHub in real-time
3. **Shows compatibility status** for each version

**Version indicators:**
- ✅ **Compatible** - Your PHP version meets requirements
- ❌ **Incompatible** - PHP version too low or too high
- 🟢 **LTS** - Long-term support version (recommended for production)

After selecting a major version, you can optionally choose a specific patch version (e.g., Laravel 11.5.0 instead of just Laravel 11).

#### JavaScript/TypeScript Frameworks

For Node.js frameworks:
- Versions are fetched from npm registry
- Latest stable version is selected by default
- You can choose any available version from the dropdown

### Step 3: Configuration

Configure installation options:

| Option | Description |
|--------|-------------|
| **Project Name** | Name of the folder to create (or use current directory) |
| **Install in current directory** | Toggle to install files directly in the current folder |
| **Database Configuration** | For frameworks that need it (Laravel, WordPress, etc.) |

**Database configuration** (when applicable):
- Database Host
- Database Name
- Database Username
- Database Password
- Database Port (optional)

### Step 4: Installation

Click **"Install"** to begin. The installer will:

1. Check dependencies (Composer/Node.js/npm)
2. Download the framework via the appropriate package manager
3. Configure the project (if database settings provided)
4. Display real-time installation logs

## Supported Frameworks

### Laravel

**Requirements:** PHP 8.0+ (varies by version), Composer

| Version | PHP Requirement | Status |
|---------|-----------------|--------|
| Laravel 12 | PHP 8.3+ | Latest |
| Laravel 11 | PHP 8.2+ | LTS |
| Laravel 10 | PHP 8.1+ | LTS |
| Laravel 9 | PHP 8.0 - 8.2 | EOL |
| Laravel 8 | PHP 7.3 - 8.1 | EOL |

**What gets installed:**
- Laravel framework via Composer
- Default `.env` configuration
- Database credentials (if provided)

### WordPress

**Requirements:** PHP 5.6+ (7.4+ recommended)

**Features:**
- Fetches versions from GitHub (WordPress/WordPress repository)
- Auto-configures `wp-config.php` with database credentials
- Downloads from official WordPress releases

**Versions:**
- **Latest** - Always installs the newest stable release
- **Major versions** (6.7, 6.6, 6.5, etc.) - Choose specific major releases
- **Specific versions** - Select exact patch versions

### Symfony

**Requirements:** PHP 8.0+ (varies by version), Composer

| Version | PHP Requirement |
|---------|-----------------|
| Symfony 8.x | PHP 8.3+ |
| Symfony 7.x | PHP 8.2+ |
| Symfony 6.4 | PHP 8.1+ (LTS) |
| Symfony 5.4 | PHP 7.2.5+ (LTS) |

### CodeIgniter

**CodeIgniter 4** (PHP 8.1+):
- Installed via Composer
- Modern MVC framework

**CodeIgniter 3** (PHP 5.6+):
- Downloaded from GitHub releases
- Legacy version for older servers

### Express.js

**Requirements:** Node.js 14+

Creates a minimal Express.js project with:
- Basic server setup
- Package.json with dependencies
- Optional TypeScript configuration

### NestJS

**Requirements:** Node.js 16+

Installs the full NestJS framework with:
- CLI-generated project structure
- TypeScript configuration
- Database module setup (if configured)

### Vue.js / Nuxt.js

**Requirements:** Node.js 16+

**Vue.js:**
- Creates a Vite-based Vue 3 project
- TypeScript support optional

**Nuxt.js:**
- Full-stack Vue framework
- SSR/SSG capabilities

### React / Next.js

**Requirements:** Node.js 16+

**React:**
- Create React App or Vite template
- Modern React 18+ features

**Next.js:**
- Full-stack React framework
- App Router (latest)

### TypeScript Node

**Requirements:** Node.js 16+

Creates a TypeScript-configured Node.js project with:
- tsconfig.json
- ESLint configuration
- Build scripts

## Dynamic Version Fetching

One of the most powerful features of the Source Installer is **dynamic version fetching**:

### How It Works

1. **Real-time API calls** - When you select a framework, Marix fetches available versions from:
   - **GitHub Releases API** for Laravel, CodeIgniter
   - **GitHub Tags API** for WordPress
   - **npm Registry** for JavaScript frameworks

2. **Auto-discovery of new versions** - When Laravel 13 or WordPress 7 is released, it will automatically appear in the version list—no app update required.

3. **Fallback handling** - If API calls fail (network issues), the installer falls back to known stable versions.

### Version Sources

| Framework | API Source | Update Frequency |
|-----------|------------|------------------|
| Laravel | GitHub Releases (`laravel/laravel`) | Real-time |
| WordPress | GitHub Tags (`WordPress/WordPress`) | Real-time |
| Symfony | symfony.com API | Real-time |
| CodeIgniter | GitHub Releases (`bcit-ci/CodeIgniter`, `codeigniter4/appstarter`) | Real-time |
| Node.js Frameworks | npm Registry | Real-time |

## Troubleshooting

### "Composer not found"

Install Composer on your server:
```bash
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
```

### "Node.js not found"

Install Node.js using nvm:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install --lts
```

### "PHP version incompatible"

Check your server's PHP version:
```bash
php -v
```

To upgrade PHP on Ubuntu:
```bash
sudo add-apt-repository ppa:ondrej/php
sudo apt update
sudo apt install php8.3
```

### "Permission denied"

Ensure your SSH user has write permissions to the target directory:
```bash
sudo chown -R $USER:$USER /var/www/html
```

## Best Practices

1. **Use specific versions in production** - Select exact patch versions for reproducible deployments
2. **Check PHP compatibility first** - The installer warns you, but always verify
3. **Configure database before installing** - Saves time vs. editing configs later
4. **Install in clean directories** - Avoid conflicts with existing files
5. **Use "Install in current directory"** - When you've already created and navigated to the project folder

## Multi-Language Support

The Source Installer interface is fully localized and available in:

| Language | | Language | |
|----------|---|----------|---|
| 🇺🇸 English | 🇻🇳 Tiếng Việt | 🇨🇳 中文 | 🇯🇵 日本語 |
| 🇰🇷 한국어 | 🇫🇷 Français | 🇩🇪 Deutsch | 🇪🇸 Español |
| 🇧🇷 Português | 🇷🇺 Русский | 🇹🇭 ภาษาไทย | 🇲🇾 Bahasa Melayu |
| 🇮🇩 Bahasa Indonesia | 🇵🇭 Filipino | | |

The language is automatically selected based on your system language or can be changed in Settings.

---

## Changelog

### v1.0.8 (January 2026)
- ✅ Dynamic version fetching from GitHub APIs
- ✅ Auto-discover new Laravel/WordPress versions
- ✅ Multi-language support (14 languages)
- ✅ Compress/Extract files in SFTP
- ✅ Improved PHP version compatibility checks

### v1.0.7 (December 2025)
- ✅ Initial Source Installer release
- ✅ Support for Laravel, WordPress, Symfony, CodeIgniter
- ✅ Node.js framework support
- ✅ Database configuration
