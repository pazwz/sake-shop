# Sprint 9 — Admin Authentication & Authorization

## Authentication

- Added administrator login and logout endpoints, backed by `AdminUser`.
- Passwords use `bcryptjs` with cost factor 12. Plaintext passwords are never
  persisted.
- An active administrator with a non-null `passwordHash` is required before
  password verification is attempted.

## Session and cookie

- Sessions use a signed, eight-hour JWT stored only in the `kura_admin_session`
  HttpOnly cookie.
- Cookies use `SameSite=Lax`, path `/`, and `Secure` in production. The session
  token contains only administrator ID and role.
- `ADMIN_SESSION_SECRET` is preferred, with `JWT_SECRET` retained as a
  compatibility fallback. Login attempts have an in-memory five-attempt,
  fifteen-minute rate-limit hook per IP/email key.

## Authorization

- `OWNER` and `MANAGER` can manage CMS collections.
- `STAFF` can read collection listings but receives `403` for CMS writes and is
  redirected away from collection create/edit pages.
- The authorization service rechecks the active administrator in the database
  for protected API calls, so disabled accounts and accounts without a password
  hash cannot use an existing session.

## Protected routes

- `proxy.ts` redirects unauthenticated `/admin/*` requests to `/admin/login`.
- Unauthenticated `/api/v1/admin/*` requests return the standard `401` API
  response. Protected CMS API handlers also enforce roles in the service layer.
- Admin pages show the current administrator, role, and a logout action.

## Database and seed

- Added nullable `AdminUser.passwordHash` through migration
  `20260809155259_add_admin_password_hash`.
- `.env.example` documents `ADMIN_SEED_PASSWORD` and `ADMIN_SESSION_SECRET`
  without values.
- The development seed hashes `ADMIN_SEED_PASSWORD` for active OWNER, MANAGER,
  and STAFF accounts; it also creates disabled and null-password accounts for
  verification. No password is committed.

## Verification

- Verified unauthenticated admin-page redirect and unauthenticated API `401`.
- Verified incorrect password, disabled administrator, and null-password
  administrator are denied.
- Verified OWNER and MANAGER CMS access, STAFF CMS write `403`, and logout
  session invalidation.
- `pnpm prisma format`, `pnpm prisma validate`, `pnpm prisma generate`,
  `pnpm prisma migrate dev --name add_admin_password_hash`, and
  `pnpm prisma:seed` passed.
- `pnpm lint` and `pnpm build` passed.

## Not included

- Orders, payments, Smaregi, S3, shipping, and administrator-management UI.
