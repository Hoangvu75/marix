# Google Drive 백업 설정 가이드

> **언어**: [🇺🇸 English](GOOGLE_DRIVE_SETUP.en.md) | [🇻🇳 Tiếng Việt](GOOGLE_DRIVE_SETUP.vi.md) | [🇮🇩 Bahasa Indonesia](GOOGLE_DRIVE_SETUP.id.md) | [🇨🇳 中文](GOOGLE_DRIVE_SETUP.zh.md) | [🇰🇷 한국어](GOOGLE_DRIVE_SETUP.ko.md) | [🇯🇵 日本語](GOOGLE_DRIVE_SETUP.ja.md) | [🇫🇷 Français](GOOGLE_DRIVE_SETUP.fr.md) | [🇩🇪 Deutsch](GOOGLE_DRIVE_SETUP.de.md) | [🇪🇸 Español](GOOGLE_DRIVE_SETUP.es.md) | [🇹🇭 ภาษาไทย](GOOGLE_DRIVE_SETUP.th.md) | [🇲🇾 Bahasa Melayu](GOOGLE_DRIVE_SETUP.ms.md) | [🇷🇺 Русский](GOOGLE_DRIVE_SETUP.ru.md) | [🇵🇭 Filipino](GOOGLE_DRIVE_SETUP.fil.md) | [🇧🇷 Português](GOOGLE_DRIVE_SETUP.pt.md)

---

## 1단계: Google Cloud 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 오른쪽 상단의 **"새 프로젝트"** 클릭
3. 프로젝트 이름 지정: `Marix SSH Client` 또는 원하는 이름
4. **"만들기"** 클릭

## 2단계: Google Drive API 활성화

1. 새로 생성한 프로젝트에서 **"API 및 서비스"** > **"라이브러리"** 이동
2. **"Google Drive API"** 검색
3. 결과 클릭 후 **"사용 설정"** 누르기

## 3단계: OAuth 2.0 인증 정보 생성

### 3.1. OAuth 동의 화면 구성

1. **"API 및 서비스"** > **"OAuth 동의 화면"** 이동
2. **"외부"** 선택 (모든 Google 계정 사용자 허용)
3. **"만들기"** 클릭

**앱 정보:**
- 앱 이름: `Marix SSH Client`
- 사용자 지원 이메일: `your-email@gmail.com`
- 앱 로고: (선택사항) 로고 업로드
- 애플리케이션 홈페이지: `https://github.com/marixdev/marix`
- 애플리케이션 개인정보처리방침 링크: (선택사항)
- 애플리케이션 서비스 약관 링크: (선택사항)

**개발자 연락처 정보:**
- 이메일 주소: `your-email@gmail.com`

4. **"저장 후 계속"** 클릭

**범위:**
5. **"범위 추가 또는 삭제"** 클릭
6. 다음 범위 선택:
   - `https://www.googleapis.com/auth/drive.file` (이 앱이 생성한 파일만)
7. **"업데이트"** 및 **"저장 후 계속"** 클릭

**테스트 사용자:** (게시 상태 = 테스트 중일 때만 필요)
8. **"사용자 추가"** 클릭
9. 테스트할 Google 계정 이메일 입력
10. **"저장 후 계속"** 클릭

11. 검토 후 **"대시보드로 돌아가기"** 클릭

### 3.2. OAuth 클라이언트 ID 생성

1. **"API 및 서비스"** > **"사용자 인증 정보"** 이동
2. **"사용자 인증 정보 만들기"** > **"OAuth 클라이언트 ID"** 클릭
3. **"데스크톱 앱"** 선택 (Electron 앱용)
4. 이름 지정: `Marix Desktop Client`
5. **"만들기"** 클릭

6. **JSON 파일 다운로드**: 방금 생성한 인증 정보의 다운로드 아이콘 클릭
   - 파일 이름: `client_secret_xxx.apps.googleusercontent.com.json`
   - 이 파일을 `src/main/services/` 폴더에 `google-credentials.json`으로 저장

7. **클라이언트 ID 및 클라이언트 보안 비밀 저장**:
```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uris": ["http://localhost"]
  }
}
```

## 4단계: Marix에서 구성

1. `google-credentials.json` 파일을 `src/main/services/` 폴더에 복사
2. **중요**: `.gitignore`에 추가:
```
src/main/services/google-credentials.json
```

3. 앱이 시작 시 자동으로 인증 정보 로드

## 5단계: OAuth 흐름 테스트

1. Marix 앱 열기
2. **설정** > **백업 및 복원** > **백업 생성/복원** 이동
3. **"Google Drive"** 탭 선택
4. **"Google Drive에 연결"** 클릭
5. Google OAuth 화면이 브라우저에서 열림
6. Google 계정 선택 및 권한 부여
7. 앱이 토큰을 받고 "연결됨" 표시

## 보안 참고사항

- `google-credentials.json`을 Git에 **커밋하지 마세요**
- 클라이언트 보안 비밀은 프로덕션에서 암호화 또는 난독화 필요
- 새로고침 토큰은 Electron store에 저장됨 (암호화)
- 최소 필요 권한만 요청

## 앱 게시 (선택사항)

앱을 공개하려면:

1. **OAuth 동의 화면** 이동
2. **"앱 게시"** 클릭
3. Google이 앱 검토 (1-2주)
4. 승인 후 "확인되지 않은 앱" 경고 없이 누구나 사용 가능

## 문제 해결

### 오류: "Access blocked: This app's request is invalid"
- OAuth 동의 화면이 완전히 구성되었는지 확인
- redirect_uri가 설정과 일치하는지 확인

### 오류: "The OAuth client was not found"
- 인증 정보 파일의 클라이언트 ID 확인
- Google Cloud Console에서 JSON 파일 다시 다운로드

### 오류: "Access denied"
- 사용자가 권한 부여 거부
- OAuth 동의 화면에 적절한 범위 추가
