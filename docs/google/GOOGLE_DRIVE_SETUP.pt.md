# Guia de Configuração de Backup do Google Drive

> **Idiomas**: [🇺🇸 English](GOOGLE_DRIVE_SETUP.en.md) | [🇻🇳 Tiếng Việt](GOOGLE_DRIVE_SETUP.vi.md) | [🇮🇩 Bahasa Indonesia](GOOGLE_DRIVE_SETUP.id.md) | [🇨🇳 中文](GOOGLE_DRIVE_SETUP.zh.md) | [🇰🇷 한국어](GOOGLE_DRIVE_SETUP.ko.md) | [🇯🇵 日本語](GOOGLE_DRIVE_SETUP.ja.md) | [🇫🇷 Français](GOOGLE_DRIVE_SETUP.fr.md) | [🇩🇪 Deutsch](GOOGLE_DRIVE_SETUP.de.md) | [🇪🇸 Español](GOOGLE_DRIVE_SETUP.es.md) | [🇹🇭 ภาษาไทย](GOOGLE_DRIVE_SETUP.th.md) | [🇲🇾 Bahasa Melayu](GOOGLE_DRIVE_SETUP.ms.md) | [🇷🇺 Русский](GOOGLE_DRIVE_SETUP.ru.md) | [🇵🇭 Filipino](GOOGLE_DRIVE_SETUP.fil.md) | [🇧🇷 Português](GOOGLE_DRIVE_SETUP.pt.md)

---

## Passo 1: Criar Projeto do Google Cloud

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Clique em **"Novo Projeto"** no canto superior direito
3. Nomeie seu projeto: `Marix SSH Client` ou qualquer nome que preferir
4. Clique em **"Criar"**

## Passo 2: Ativar API do Google Drive

1. No seu projeto recém-criado, vá para **"APIs e Serviços"** > **"Biblioteca"**
2. Pesquise **"Google Drive API"**
3. Clique no resultado e pressione **"Ativar"**

## Passo 3: Criar Credenciais OAuth 2.0

### 3.1. Configurar Tela de Consentimento OAuth

1. Vá para **"APIs e Serviços"** > **"Tela de consentimento OAuth"**
2. Selecione **"Externo"** (permite qualquer usuário de conta Google)
3. Clique em **"Criar"**

**Informações do aplicativo:**
- Nome do aplicativo: `Marix SSH Client`
- E-mail de suporte ao usuário: `your-email@gmail.com`
- Logo do aplicativo: (opcional)
- Página inicial do aplicativo: `https://github.com/marixdev/marix`

**Informações de contato do desenvolvedor:**
- Endereços de e-mail: `your-email@gmail.com`

4. Clique em **"Salvar e continuar"**

**Escopos:**
5. Clique em **"Adicionar ou remover escopos"**
6. Encontre e selecione:
   - `https://www.googleapis.com/auth/drive.file`
7. Clique em **"Atualizar"** e **"Salvar e continuar"**

### 3.2. Criar ID do Cliente OAuth

1. Vá para **"APIs e Serviços"** > **"Credenciais"**
2. Clique em **"Criar credenciais"** > **"ID do cliente OAuth"**
3. Selecione **"Aplicativo para computador"**
4. Nomeie: `Marix Desktop Client`
5. Clique em **"Criar"**

6. **Baixar arquivo JSON**: Clique no ícone de download
7. **Para desenvolvimento local**: Crie `google-credentials.json` em `src/main/services/`:
```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "YOUR_CLIENT_SECRET"
  }
}
```

8. **Para builds CI/CD**: Use GitHub Secrets (veja abaixo)

## Passo 4: Configurar no Marix

### Opção A: Desenvolvimento Local

1. Copie o arquivo `google-credentials.json` para a pasta `src/main/services/`
2. **IMPORTANTE**: Adicione ao `.gitignore`:
```
src/main/services/google-credentials.json
```

### Opção B: CI/CD com GitHub Secrets (Recomendado)

1. Vá para seu repositório GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Adicione esses secrets:
   - `GOOGLE_CLIENT_ID`: Seu OAuth Client ID
   - `GOOGLE_CLIENT_SECRET`: Seu OAuth Client Secret
3. O workflow de build injetará automaticamente as credenciais durante o build

## Passo 5: Testar Fluxo OAuth

1. Abra o aplicativo Marix
2. Vá para **Configurações** > **Backup e Restauração**
3. Selecione a aba **"Google Drive"**
4. Clique em **"Conectar ao Google Drive"**
5. O navegador abrirá com a tela OAuth do Google
6. Selecione sua conta Google e conceda permissões
7. O aplicativo receberá o token e exibirá "Conectado"

## Notas de Segurança

- **NÃO** faça commit de `google-credentials.json` no Git
- Use **GitHub Secrets** para builds CI/CD para proteger o client_secret
- Tokens de atualização são armazenados no Electron store (criptografados)
- PKCE é usado para segurança adicional do fluxo OAuth

## Publicar Aplicativo (Obrigatório)

1. Vá para **Tela de consentimento OAuth**
2. Clique em **"Publicar aplicativo"**
3. Seu aplicativo será aprovado imediatamente
4. Qualquer pessoa pode usá-lo sem avisos de "aplicativo não verificado"

## Solução de Problemas

### Erro: "Access blocked: This app's request is invalid"
- Verifique se a tela de consentimento OAuth está totalmente configurada

### Erro: "The OAuth client was not found"
- Verifique o Client ID no arquivo de credenciais
- Baixe novamente o arquivo JSON do Google Cloud Console

### Erro: "Access denied"
- O usuário negou a concessão de permissão
