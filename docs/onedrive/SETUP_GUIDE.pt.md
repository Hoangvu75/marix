# Guia de Configuração do Microsoft OneDrive OAuth2

Este guia ajuda você a configurar a autenticação OAuth2 do OneDrive para Marix.

## Pré-requisitos

- Uma conta Microsoft pessoal
- Acesso ao [Portal do Azure](https://portal.azure.com)

## Passo 1: Registrar uma Nova Aplicação

1. Acesse [Portal do Azure - Registros de aplicativos](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. Clique em **"Novo registro"**
3. Preencha os detalhes:
   - **Nome**: `Marix SSH Client`
   - **Tipos de conta com suporte**: Selecione **"Apenas contas pessoais da Microsoft"**
   - **URI de redirecionamento**: Deixar vazio (será adicionado no passo 3)
4. Clique em **"Registrar"**

## Passo 2: Anotar o ID do Aplicativo

Após o registro:
1. Copie o **ID do aplicativo (cliente)**
2. Guarde em local seguro

## Passo 3: Configurar Autenticação (Porta Aleatória)

Marix usa redirecionamento **RFC 8252** com portas aleatórias para maior segurança.

1. Clique em **"Autenticação"**
2. Em **"Configurações de plataforma"**, clique em **"Adicionar uma plataforma"**
3. Selecione **"Aplicativos móveis e de desktop"**
4. ⚠️ **Importante**: Adicione MÚLTIPLOS URIs de redirecionamento:
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
5. Também marque: `https://login.microsoftonline.com/common/oauth2/nativeclient`
6. Em **"Configurações avançadas"**:
   - Defina **"Permitir fluxos de cliente público"** como **Sim** ⚠️
7. Clique em **"Salvar"**

## Passo 4: Configurar Permissões de API

1. Clique em **"Permissões de API"**
2. Clique em **"Adicionar uma permissão"**
3. Selecione **"Microsoft Graph"** → **"Permissões delegadas"**
4. Adicione:
   - ✅ `Files.ReadWrite`
   - ✅ `User.Read`
   - ✅ `offline_access`
5. Clique em **"Adicionar permissões"**

## Passo 5: Criar Arquivo de Credenciais

**Para desenvolvimento local**: Edite `src/main/services/onedrive-credentials.json`:

```json
{
  "client_id": "SEU_ID_DE_CLIENTE"
}
```

**Para builds CI/CD**: Use GitHub Secrets (veja abaixo)

## Passo 6: Configurar no Marix

### Opção A: Desenvolvimento Local

1. Crie o arquivo `onedrive-credentials.json` na pasta `src/main/services/`
2. **IMPORTANTE**: Adicione ao `.gitignore`:
```
src/main/services/onedrive-credentials.json
```

### Opção B: CI/CD com GitHub Secrets (Recomendado)

1. Vá para seu repositório GitHub → **Settings** → **Secrets and variables** → **Actions**
2. Adicione este secret:
   - `ONEDRIVE_CLIENT_ID`: Seu OAuth Application (Client) ID
3. O workflow de build injetará automaticamente as credenciais durante o build

## Passo 7: Compilar e Testar

```bash
npm run build
npm start
```

## Notas de Segurança

- ✅ **PKCE**: Não requer client_secret
- ✅ **RFC 8252**: Redirecionamento loopback com portas aleatórias
- ✅ **Criptografia E2E**: Argon2id + AES-256-GCM
- 📁 **Localização**: `/Marix/backup.marix`
- Use **GitHub Secrets** para builds CI/CD para proteger credenciais
