# Microsoft OneDrive OAuth2 설정 가이드

이 가이드는 Marix의 OneDrive OAuth2 인증 설정 방법을 안내합니다.

## 사전 요구 사항

- 개인 Microsoft 계정
- [Azure 포털](https://portal.azure.com) 접근

## 1단계: 새 애플리케이션 등록

1. [Azure 포털 - 앱 등록](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)으로 이동
2. **"새 등록"** 클릭
3. 세부 정보 입력:
   - **이름**: `Marix SSH Client`
   - **지원되는 계정 유형**: **"개인 Microsoft 계정만"** 선택
   - **리디렉션 URI**: 비워두기 (3단계에서 추가)
4. **"등록"** 클릭

## 2단계: 애플리케이션 ID 기록

등록 후:
1. **애플리케이션(클라이언트) ID** 복사
2. 안전한 곳에 저장

## 3단계: 인증 구성 (랜덤 포트)

Marix는 보안을 위해 **RFC 8252** 준수 루프백 리디렉션과 랜덤 포트를 사용합니다.

1. **"인증"** 클릭
2. **"플랫폼 구성"**에서 **"플랫폼 추가"** 클릭
3. **"모바일 및 데스크톱 애플리케이션"** 선택
4. ⚠️ **중요**: 여러 리디렉션 URI 추가:
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
5. `https://login.microsoftonline.com/common/oauth2/nativeclient`도 체크
6. **"고급 설정"**에서:
   - **"공용 클라이언트 흐름 허용"**을 **예**로 설정 ⚠️
7. **"저장"** 클릭

## 4단계: API 권한 구성

1. **"API 권한"** 클릭
2. **"권한 추가"** 클릭
3. **"Microsoft Graph"** → **"위임된 권한"** 선택
4. 추가:
   - ✅ `Files.ReadWrite`
   - ✅ `User.Read`
   - ✅ `offline_access`
5. **"권한 추가"** 클릭

## 5단계: 자격 증명 파일 생성

**로컬 개발용**: `src/main/services/onedrive-credentials.json` 편집:

```json
{
  "client_id": "귀하의_클라이언트_ID"
}
```

**CI/CD 빌드용**: GitHub Secrets 사용 (아래 참조)

## 6단계: Marix에서 구성

### 옵션 A: 로컬 개발

1. `src/main/services/` 폴더에 `onedrive-credentials.json` 파일 생성
2. **중요**: `.gitignore`에 추가:
```
src/main/services/onedrive-credentials.json
```

### 옵션 B: GitHub Secrets로 CI/CD (권장)

1. GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions**로 이동
2. 이 시크릿 추가:
   - `ONEDRIVE_CLIENT_ID`: OAuth 애플리케이션 (클라이언트) ID
3. 빌드 워크플로우가 빌드 시 자동으로 자격 증명을 주입

## 7단계: 빌드 및 테스트

```bash
npm run build
npm start
```

## 보안 참고 사항

- ✅ **PKCE**: client_secret 불필요
- ✅ **RFC 8252**: 랜덤 포트로 루프백 리디렉션
- ✅ **E2E 암호화**: Argon2id + AES-256-GCM
- 📁 **저장 위치**: `/Marix/backup.marix`
- CI/CD 빌드에는 자격 증명을 보호하기 위해 **GitHub Secrets** 사용
