## Purpose
- Short context for the frontend agent.

## Source of truth
- `src/environments/environment.ts`
- `proxy.conf.json`
- `src/app/**`

## Do
- Use API through infrastructure nginx and gateway (`/api/...`) with `withCredentials` when required.
- Keep login/register/change-password flow aligned with auth API.
- Login UI: on `401/423` show remaining login attempts / lockout info.
- After successful register, call login and redirect to `/app`.
- Keep login payload aligned with auth contract, including `rememberMe`.
- Login: Enter on Remember me toggles the checkbox (does not submit); Space also toggles.
- Keep register client-side validation aligned with auth:
  - `name`: trim, 2-50, Unicode letters + single space/apostrophe/hyphen.
  - `surname`: trim, 2-80, Unicode letters + single space/apostrophe/hyphen.
  - `username`: trim, `^[a-zA-Z0-9._-]{3,30}$`.
  - `password`: length 8-128.
- In dev, keep proxy `/api` on `https://localhost:8080` (infrastructure nginx HTTPS).
- In docker (Production), serve frontend on `https://localhost:4200` (`ui-web-prod`); frontend nginx proxies `/api` to `http://gw-nginx:80`.
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
- Site header logo: `/app` when authenticated, `/` when guest. On manage route, logo is hidden; puzzle logo lives in the sidebar and links to `/app`.
- Authenticated header uses avatar photo or initials menu with Profile (`/app/profile`) and Log out (Escape / outside click closes).
- Authenticated header shows Notifications link (`/app/notifications`); hidden for guests.
- `/app` shows organization list for the logged-in user (`OrganizationList`).
- `/app/profile` (`Profile`): GET/PATCH `/api/auth/v1/me` (name, surname, email; username read-only), avatar upload/remove (`PUT|DELETE /me/avatar`), authenticated password change (`POST /me/change-password`). After password change or email change, clear local session (`AuthService.clearLocalSession`) and redirect to `/login` (server revokes refresh sessions).
- `/app/notifications` (`Notifications`): inbox via `NotificationService` (`GET /api/notifications/v1/me`); All/Unread filters; mark as read / mark all as read (`POST .../read`, `POST .../read-all`). `environment.notificationsApiUrl` = `/api/notifications/v1`.
- `/app/organizations/:slug` shows organization hub with action tiles (`OrganizationPlaceholder`).
- `/app/organizations/:slug/manage` (`OrganizationManage`): compact header (56px) with breadcrumb `Organizations / {name} / Manage`, fixed collapsible sidebar (white background; persisted in `localStorage` key `teamhub.orgManage.sidebarCollapsed`, default collapsed), sticky page title (no subtitles/borders) pinned at top of the manage content scrollport. Content area uses light gray background (`$color-bg-alt`); panel content on white cards. `.app-layout--org-manage` locks viewport height; `.org-manage__content` scrolls. `OrgManageLayoutService` syncs shell offset and org context. Accent color is cyan (`$color-org-primary` / CSS vars on `.app-layout--org-manage`); main app keeps mint `$color-primary`.
- Organization API base: `environment.organizationsApiUrl` (`/api/organizations/v1`).
- GraphQL: `environment.graphqlUrl` (`/api/graphql`) for composed reads (All Members table, Audit Log).

## Organizations
- `OrganizationService` (`src/app/core/organizations/organization.service.ts`):
  - Organization: list, getById, getBySlug, createWithDetails, update, updateStatus, delete, restore, transferOwnership, leave, uploadAvatar, deleteAvatar
  - Model: `Organization.status` (`active` | `suspended` | `archived`); recently-deleted restore helper in `organization-api.utils.ts` (`sessionStorage` key `teamhub.org.recentlyDeleted`)
  - Me: getMe (`roles[]` + permission codes), listMyInvitations (`GET /me/invitations`; tokens not returned)
  - Members: getMember, addMember (`roleIds[]`), updateMember (`roleIds[]` replace), removeMember, listMemberTeams
  - `OrganizationGraphqlService.listMembers` powers All Members table (name/surname via BFF GraphQL)
  - `OrganizationGraphqlService.listActivity` powers Audit Log tab (actor/target profiles + server pagination)
  - Teams: listTeams, getTeam, createTeam, updateTeam, deleteTeam, uploadTeamAvatar, deleteTeamAvatar, listTeamMembers, addTeamMember, updateTeamMember, removeTeamMember
  - Stats: getStats (`memberCount`, `teamCount`)
  - Roles: listRoles, getRole, createRole, updateRole, deleteRole, replaceRolePermissions (`permissionIds`)
  - Permissions: listPermissions(`orgId`), getPermission, createPermission, updatePermission, deletePermission (org-scoped)
  - Invitations: listInvitations, getInvitation, createInvitation (`orgRoleIds[]`, optional `teamId`/`teamRoleId`), cancelInvitation, resendInvitation, getInvitationByToken, acceptInvitationByToken, rejectInvitationByToken
  - Import/Export: previewImport, startImport, startExport, listImportExportJobs, getImportExportJob, getImportExportDownload
  - Link-only invites (MVP): create/resend returns token; UI shows copyable `/app/invitations/accept?token=...` (no email delivery)
- Org list (`OrganizationList`): pending invitations section (`listMyInvitations`); restore banner after soft-delete
- Invitation accept (`/app/invitations/accept?token=`): Accept + Reject
- Manage UI panels (`src/app/private/pages/organizations/manage/`):
  - All Members table columns: Name, Surname, Roles, Teams, Joined (user profiles from GraphQL)
  - `OrgMemberListPanel` — All Members: client-side search (name/surname/username), column sort/filter (name, surname, joined), pagination (10/page), overflow row menu (`Details`, `Edit roles`, `Remove`), multi-select ORG roles in details (`roleIds[]`), `+ Add Member` header action opens `AddMemberModal`
  - `AddMemberModal` — search users via `AuthService.searchUsers` (`GET /api/auth/v1/users?q=`; `q` min 2 chars), dropdown excludes current org members; select user then **Add to organization** assigns fixed org **Member** role via `OrganizationService.addMember`; ArrowUp/ArrowDown + Enter select from list; search after 300ms idle (debounce)
  - `AuthService.searchUsers(q, pageSize?)` — authenticated user search for Add Member / Add to team pickers (`q` length < 2 → empty client-side)
  - `AuthService.getMe` / `updateMe` / `changeMyPassword` / `uploadAvatar` / `deleteAvatar` / `clearLocalSession` — profile page (`/app/profile`)
  - Shared: `OverflowMenu` (`src/app/shared/overflow-menu/`), `TablePagination` (`src/app/shared/table-pagination/`)
  - `OrgAddMemberPanel` — email invitations + optional team/team role + pending list (`orgRoleIds`)
  - `OrgAuditLogPanel` — chronological audit feed: type filter, search, server pagination (20/page); columns Type, User, Actor, When, Details
  - `OrgSettingsPanel` — identity (avatar, slug, read-only email, status), editable details, lifecycle status PATCH, owner transfer ownership, leave/soft-delete (restore via org list banner); requires `org.manage` / `org.delete` / Owner as gated
  - `OrgTeamsPanel` — Teams: search/sort/pagination, details with edit name/description, team avatar upload/remove, team member add/edit/remove; `+ Add Team` (`org.teams.manage`)
  - `AddTeamModal` — name (required) + description → `OrganizationService.createTeam`
  - `OrgRolesPanel` — section tabs (Create role, Organization roles, Team roles); create, detail, custom role name/description update, permission replace, delete custom
  - `OrgPermissionsPanel` — create custom permission, catalog list + detail, custom name/description update, delete non-system
  - `OrgStatisticPanel` — Statistic tab: member and team totals from REST `getStats`
  - `OrgImportExportPanel` — CSV import (preview + async) + CSV/JSON export + job history (`org.members.manage`)
- Create modal: `CreateOrganizationModal` — fields: name, description, nip (10 digits), address (country, city, postal code), photo (optional); calls `createWithDetails()` (`POST` + optional `PUT .../avatar`). Org `email` is server-generated (`{name}{4digits}@teamhub.local`).
- Reusable `Sidebar` (`src/app/shared/sidebar/`): tree `items` + `activeId` + `collapsed`; `itemSelect` + `collapsedChange`; collapsed CSS tooltips; chevron row toggles; `aria-current` / `aria-expanded` / `:focus-visible`.
- Manage nav: Members (All Members, Invitations), Organization (Details, Import / Export), Teams, Role/Permission (Roles, Permissions), Statistic, Audit Log.
- JWT Bearer token is attached by `authInterceptor` on all HTTP calls.

## Don't
- Do not point frontend directly at gateway or auth service URL when traffic should go through infrastructure nginx.
