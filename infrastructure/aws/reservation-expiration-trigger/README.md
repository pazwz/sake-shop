# Reservation expiration trigger — daily cleanup

The existing sake-shop-reservation-expiration-5m Scheduler is ENABLED for daily cleanup.
Its historical name does not define the launch frequency. No resources are deleted.

Effective stock never relies on cleanup:
ACTIVE AND (expiresAt IS NULL OR expiresAt > server now).
Cleanup changes only ACTIVE with non-NULL expiry <= now to EXPIRED.
Paid NULL-expiry holds remain valid. Repeated cleanup is idempotent and never modifies InventoryMirror.

Approved Production cadence (2026-10-17): daily 03:00 Asia/Tokyo
(cron(0 3 * * ? *) with timezone Asia/Tokyo, flexible time window OFF).
Only the existing expression, timezone, description and state are updated;
the target, input, IAM role, retry policy and resources remain unchanged.
Existing manual POST /api/v1/internal/reservations/expire or manual Lambda invocation
remains available using the existing approved authentication; do not execute against Production
merely to verify setup.

Existing Lambda: sake-shop-reservation-expiration-trigger.
Existing invoke role: sake-shop-reservation-expiration-scheduler-role.
Existing execution role: sake-shop-smaregi-sync-lambda-role.
Existing SSM parameter: /sake-shop/smaregi-sync-secret.
Existing HTTP timeout: 20 seconds; Lambda: 30 seconds.
Never place decrypted parameter values in commands or logs.
