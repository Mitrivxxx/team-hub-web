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
- Site header logo: `/app` when authenticated, `/` when guest. On manage route, logo is hidden; puzzle logo lives in the sidebar and links to `/app`.
- Authenticated header uses avatar initials menu with Log out (Escape / outside click closes).
- `/app` shows organization list for the logged-in user (`OrganizationList`).
- `/app/organizations/:slug` shows organization hub with action tiles (`OrganizationPlaceholder`).
- `/app/organizations/:slug/manage` (`OrganizationManage`): compact header (56px) with breadcrumb `Organizations / {name} / Manage`, fixed collapsible sidebar (white background; persisted in `localStorage` key `teamhub.orgManage.sidebarCollapsed`, default collapsed), sticky page title (no subtitles/borders) pinned at top of the manage content scrollport. Content area uses light gray background (`$color-bg-alt`); panel content on white cards. `.app-layout--org-manage` locks viewport height; `.org-manage__content` scrolls. `OrgManageLayoutService` syncs shell offset and org context. Accent color is cyan (`$color-org-primary` / CSS vars on `.app-layout--org-manage`); main app keeps mint `$color-primary`.
- Organization API base: `environment.organizationsApiUrl` (`/api/organizations/v0.1.0`).
- GraphQL: `environment.graphqlUrl` (`/api/graphql`) for composed reads (All Members table).

## Organizations
- `OrganizationService` (`src/app/core/organizations/organization.service.ts`):
  - Organization: list, getBySlug, create, update, delete, transferOwnership, leave, uploadAvatar, deleteAvatar, createWithDetails
  - Me: getMe (`roles[]` + permission codes), listMyInvitations
  - Members: listMembers (REST), getMember, addMember (`roleIds[]`), updateMember (`roleIds[]` replace), removeMember, listMemberTeams
  - `OrganizationGraphqlService.listMembers` powers All Members table (name/surname via BFF GraphQL)
  - Teams: listTeams, getTeam, createTeam, updateTeam, deleteTeam, uploadTeamAvatar, deleteTeamAvatar, listTeamMembers, addTeamMember, updateTeamMember, removeTeamMember
  - Roles: listRoles, getRole, createRole, updateRole, deleteRole, listRolePermissions, replace/add/remove role permissions (`permissionIds`), list/assign/revoke role members
  - Permissions: listPermissions(`orgId`), getPermission, createPermission, updatePermission, deletePermission (org-scoped)
  - Invitations: listInvitations, getInvitation, createInvitation (`orgRoleIds[]`), cancelInvitation, resendInvitation, getInvitationByToken, acceptInvitation, rejectInvitation
- Manage UI panels (`src/app/private/pages/organizations/manage/`):
  - All Members table columns: Name, Surname, Roles, Teams, Joined (user profiles from GraphQL)
  - `OrgMemberListPanel` — All Members: client-side search (name/surname/username), column sort/filter (name, surname, joined), pagination (10/page), overflow row menu (`Details`, `Edit role`, `Remove`), role edit in details panel, `+ Add Member` header action opens `AddMemberModal` (User GUID + role)
  - `AddMemberModal` — add member by User GUID + org role (`OrganizationService.addMember`)
  - Shared: `OverflowMenu` (`src/app/shared/overflow-menu/`), `TablePagination` (`src/app/shared/table-pagination/`)
  - `OrgAddMemberPanel` — email invitations + pending list (`orgRoleIds`)
  - `OrgSettingsPanel` — name/description, avatar, leave, delete
  - `OrgTeamsPanel` — team list/create/delete + team members
  - `OrgRolesPanel` — section tabs (Create role, Organization roles, Team roles); create, detail, permission attach by id, delete custom; shared tab styles in `_manage-panel.scss`
  - `OrgPermissionsPanel` — org permission catalog CRUD + detail (roles using permission)
- Create modal: `CreateOrganizationModal` — fields: name, description, photo (optional); calls `createWithDetails()` (`POST` + optional `PUT .../avatar`).
- Reusable `Sidebar` (`src/app/shared/sidebar/`): tree `items` + `activeId` + `collapsed`; `itemSelect` + `collapsedChange`; collapsed CSS tooltips; chevron row toggles; `aria-current` / `aria-expanded` / `:focus-visible`.
- Manage nav: Members (All Members, Invitations, Roles, Permissions, Activity, Import / Export), Organization, Role/Permission (Teams, Role), Statistic, Audit Log. Activity, Import / Export, Statistic and Audit Log remain placeholders.
- JWT Bearer token is attached by `authInterceptor` on all HTTP calls.

## Don't
- Do not point frontend directly at gateway or auth service URL when traffic should go through infrastructure nginx.
