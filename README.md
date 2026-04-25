# Character Chat AI

## 실행 전 준비

Node.js가 설치되어 있어야 합니다.

## Backend 실행

```bash
cd backend
npm install
copy .env.example .env
```

`.env` 파일을 열고 `GEMINI_API_KEY`에 본인 API 키를 넣으세요.

```bash
npm run dev
```

## Frontend 실행

`frontend/index.html` 파일을 브라우저로 열면 됩니다.

## 폴더 구조

```text
characterChat_AI/
├─ backend/
│  ├─ server.js
│  ├─ package.json
│  └─ .env.example
└─ frontend/
   ├─ index.html
   ├─ style.css
   └─ script.js
```
