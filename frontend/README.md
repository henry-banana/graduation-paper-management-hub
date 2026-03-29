# KLTN Frontend

Next.js 14 Frontend for HCM-UTE Graduation Management System.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000

## Environment Variables

- `NEXT_PUBLIC_API_BASE_URL`: Backend API base URL (recommended key used by the app).
- `NEXT_PUBLIC_API_URL`: Backward-compatible key; keep same value as `NEXT_PUBLIC_API_BASE_URL`.
- `NEXT_PUBLIC_APP_ENV`: Environment label (`development`, `staging`, `production`).
- `NEXT_PUBLIC_ENABLE_DEV_ROLE_SWITCHER`: Set to `true` only for local debugging role switcher UI.

## Auth Flow

- Login page redirects to backend Google OAuth endpoint:
  - `${NEXT_PUBLIC_API_BASE_URL}/auth/google`
- Backend redirects back to frontend callback route:
  - `/auth/callback?accessToken=...&refreshToken=...&expiresIn=...`
- Frontend callback page stores session, calls `/auth/me`, then routes by role:
  - `STUDENT` -> `/student/notifications`
  - `LECTURER` -> `/gvhd/pending`
  - `TBM` -> `/tbm/periods`
- Route protection is enforced by `middleware.ts` using auth/session cookies.

## Build & Check

```bash
npm run typecheck
npm run lint
npm run build
```
