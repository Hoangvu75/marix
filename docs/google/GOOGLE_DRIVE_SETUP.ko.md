# Google Drive 백업 설정 가이드

> **언어**: [🇺🇸 English](GOOGLE_DRIVE_SETUP.en.md) | [🇻🇳 Tiếng Việt](GOOGLE_DRIVE_SETUP.vi.md) | [🇮🇩 Bahasa Indonesia](GOOGLE_DRIVE_SETUP.id.md) | [🇨🇳 中文](GOOGLE_DRIVE_SETUP.zh.md) | [🇰🇷 한국어](GOOGLE_DRIVE_SETUP.ko.md) | [🇯🇵 日本語](GOOGLE_DRIVE_SETUP.ja.md) | [🇫🇷 Français](GOOGLE_DRIVE_SETUP.fr.md) | [🇩🇪 Deutsch](GOOGLE_DRIVE_SETUP.de.md) | [🇪🇸 Español](GOOGLE_DRIVE_SETUP.es.md) | [🇹🇭 ภาษาไทย](GOOGLE_DRIVE_SETUP.th.md) | [🇲🇾 Bahasa Melayu](GOOGLE_DRIVE_SETUP.ms.md) | [🇷🇺 Русский](GOOGLE_DRIVE_SETUP.ru.md) | [🇵🇭 Filipino](GOOGLE_DRIVE_SETUP.fil.md) | [🇧🇷 Português](GOOGLE_DRIVE_SETUP.pt.md)

---

## 1단계: Google Cloud 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/)로 이동
2. 오른쪽 상단의 **"새 프로젝트"** 클릭
3. 프로젝트 이름 지정: `Marix SSH Client` 또는 원하는 이름
4. **"만들기"** 클릭

## 2단계: Google Drive API 활성화

1. 새로 생성한 프로젝트에서 **"API 및 서비스"** > **"라이브러리"**로 이동
2. **"Google Drive API"** 검색
3. 결과를 클릭하고 **"사용"** 버튼 누르기

## 3단계: OAuth 2.0 자격 증명 생성

### 3.1. OAuth 동의 화면 구성

1. **"API 및 서비스"** > **"OAuth 동의 화면"**으로 이동
2. **"외부"** 선택 (모든 Google 계정 사용자 허용)
3. **"만들기"** 클릭

**앱 정보:**
- 앱 이름: `Marix SSH Client`
- 사용자 지원 이메일: `your-email@gmail.com`
- 앱 로고: (선택 사항)
- 애플리케이션 홈페이지: `https://github.com/marixdev/marix`

**개발자 연락처 정보:**
- 이메일 주소: `your-email@gmail.com`

4. **"저장 후 계속"** 클릭

**범위:**
5. **"범위 추가 또는 삭제"** 클릭
6. 다음 범위를 찾아 선택:
   - `https://www.googleapis.com/auth/drive.file`
7. **"업데이트"** 및 **"저장 후 계속"** 클릭

### 3.2. OAuth 클라이언트 ID 생성

1. **"API 및 서비스"** > **"사용자 인증 정보"**로 이동
2. **"사용자 인증 정보 만들기"** > **"OAuth 클라이언트 ID"** 클릭
3. **"데스크톱 앱"** 선택
4. 이름 지정: `Marix Desktop Client`
5. **"만들기"** 클릭

6. **JSON 파일 다운로드**: 다운로드 아이콘 클릭
7. **로컬 개발용**: `src/main/services/`에 `google-credentials.json` 생성:
```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "YOUR_CLIENT_SECRET"
  }
}
```

8. **CI/CD 빌드용**: GitHub Secrets 사용 (아래 참조)

## 4단계: Marix에서 구성

### 옵션 A: 로컬 개발

1. `google-credentials.json` 파일을 `src/main/services/` 폴더에 복사
2. **중요**: `.gitignore`에 추가:
```
src/main/services/google-credentials.json
```

### 옵션 B: GitHub Secrets로 CI/CD (권장)

1. GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions**로 이동
2. 다음 시크릿 추가:
   - `GOOGLE_CLIENT_ID`: OAuth 클라이언트 ID
   - `GOOGLE_CLIENT_SECRET`: OAuth 클라이언트 시크릿
3. 빌드 워크플로우가 빌드 시 자동으로 자격 증명을 주입

## 5단계: OAuth 흐름 테스트

1. Marix 앱 열기
2. **설정** > **백업 및 복원**으로 이동
3. **"Google Drive"** 탭 선택
4. **"Google Drive에 연결"** 클릭
5. 브라우저가 Google OAuth 화면으로 열림
6. Google 계정을 선택하고 권한 부여
7. 앱이 토큰을 받고 "연결됨" 표시

## 보안 참고 사항

- `google-credentials.json`을 Git에 커밋**하지 마세요**
- client_secret을 보호하기 위해 CI/CD 빌드에 **GitHub Secrets** 사용
- 새로 고침 토큰은 Electron 스토어에 저장됨 (암호화)
- 추가 OAuth 보안을 위해 PKCE 사용

## 앱 게시 (필수)

1. **OAuth 동의 화면**으로 이동
2. **"앱 게시"** 클릭
3. 앱이 즉시 승인됨
4. 누구나 "확인되지 않은 앱" 경고 없이 사용 가능

## 문제 해결

### 오류: "Access blocked: This app's request is invalid"
- OAuth 동의 화면이 완전히 구성되었는지 확인

### 오류: "The OAuth client was not found"
- 자격 증명 파일의 클라이언트 ID 확인
- Google Cloud Console에서 JSON 파일 다시 다운로드

### 오류: "Access denied"
- 사용자가 권한 부여를 거부함
