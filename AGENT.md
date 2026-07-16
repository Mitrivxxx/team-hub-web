## Purpose
- Short context for the frontend agent.

## Source of truth
- `src/environments/environment.ts`
- `proxy.conf.json`
- `src/app/**`

## Do
- Use API through infrastructure nginx and gateway (`/api/...`) with `withCredentials` when required.
- Keep login/register flow aligned with auth API.
- After successful register, call login and redirect to `/app`.
- Keep login payload aligned with auth contract, including `rememberMe`.
- Keep register client-side validation aligned with auth:
  - `name`: trim, 2-50, Unicode letters + single space/apostrophe/hyphen.
  - `surname`: trim, 2-80, Unicode letters + single space/apostrophe/hyphen.
  - `username`: trim, `^[a-zA-Z0-9._-]{3,30}$`.
  - `password`: length 12-128.
- In dev, keep proxy `/api` on `https://localhost:8080` (infrastructure nginx HTTPS).
- In docker (Production), serve frontend on `https://localhost:4200` (`team-hub-web-prod`); frontend nginx proxies `/api` to `http://nginx:80`.
- Set `X-Correlation-ID` on every API request via `src/app/core/http/correlation-id.interceptor.ts` (new UUID per request).
- Set `X-Session-ID` on every API request via `src/app/core/http/session-id.interceptor.ts` (one ID per visit in `sessionStorage`).
- Sync `X-Session-ID` from response header when auth returns a fallback value (`SessionContextService.syncFromResponse`).
- For register flow (`register` + auto-login), reuse one ID via `CorrelationContextService.beginFlow()` / `endFlow()` in `AuthService.register()`.
- Register interceptors in `app.config.ts` with `withInterceptors([sessionIdInterceptor, correlationIdInterceptor])`.
- Update this file after routing, auth flow, env, or proxy changes.

## Routing and auth
- `app.routes.ts` lazy-loads `public.routes` and `private.routes`.
- `AuthService.initialize()` checks session via `/refresh` on app start.
- Until `sessionReady`, show `AppLoader`.
- `authGuard` protects `/app/*`; `guestGuard` redirects logged-in users from `/login`, `/signup`, and `/forgot-password`.

## Don't
- Do not point frontend directly at gateway or auth service URL when traffic should go through infrastructure nginx.
