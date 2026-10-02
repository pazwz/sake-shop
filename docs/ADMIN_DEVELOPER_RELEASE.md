# Admin developer access: migration review and release gate

## Reviewed schema-only diff

- `20261003100000_make_admin_email_nullable`: only `admin_users.email DROP NOT NULL`.
- `20261003100100_add_admin_developer_roles`: adds ADMIN and DEVELOPER enum values; retains all legacy values.
- `20261003100200_default_admin_role`: changes the default for future rows to ADMIN, after the enum additions commit.

No migration updates or deletes any row, recreates the email index, or backfills email.
`admin_users_email_key` remains unique. Multiple NULL emails are permitted by PostgreSQL.
Review with `prisma migrate diff --from-schema-datamodel <existing-schema> --to-schema-datamodel prisma/schema.prisma --script` (no database access).

## Authorization and null audit

Username/password remains the normal login. An identifier containing `@` uses the existing email lookup.
Nullable email is not an authentication prerequisite. No Admin email verification is introduced.
Routes serialize id/name/role, not email; navigation displays name and a developer-only marker.
Inquiry authors and recipients do not derive a sender email from AdminUser.email.
Existing development seeds retain their explicit fixture email; the isolated E2E developer has null email.
Admin password/session/isActive checks remain mandatory. Current database role governs developer access, not JWT role.
Legacy roles receive operational permissions only.

Developer-only surfaces:

- `/admin/email-preview`
- `/admin/operations`
- `GET /api/v1/admin/operations/health`
- `GET /api/v1/admin/integrations/smaregi` (technical configuration/logs)
- `GET /api/v1/admin/integrations/smaregi/sync/{id}/items`

Operational Smaregi sync/exclusions and campaign preview/test remain available to ADMIN.
Internal scheduler endpoints keep their existing independent CRON secret authentication; Admin sessions grant no scheduler access.

## Production sequencing blocker

The currently deployed client/session parser knows only OWNER/MANAGER/STAFF.
Creating a new-role account and verifying its login before deploying compatible code is not a valid release sequence.
Do not apply migrations or mutate account roles until the revised release sequence is explicitly approved.

Recommended sequence: read-only preflight → apply reviewed migrations (no account changes) → deploy role-aware code →
change only the audited formal operator to ADMIN → create LINXAS Developer with username/password and null email →
verify both accounts and developer denial for the operator.

Production Developer password must be entered in a user-operated terminal with echo disabled, hashed in memory,
and never passed as a command argument, environment variable, logged output or chat message.
No Production password or developer account is provisioned by local E2E fixtures.
Preserve all existing account email/password/history and the inactive legacy author.
