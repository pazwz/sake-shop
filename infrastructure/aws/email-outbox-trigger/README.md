# Legacy email outbox trigger — DISABLED

The existing sake-shop-email-outbox-2m Scheduler remains DISABLED.
The name is historical; do not re-enable it or restore 2-minute/10-minute recovery polling.
No Lambda, role, SSM parameter or Scheduler is deleted.

Normal delivery is post-commit identifier publication to the new durable event path.
One-time schedules handle provider retry and future Newsletter campaigns.
See ../email-events/README.md for definitions, minimum IAM and rollout prerequisites.
Those resources are NOT provisioned and the application is NOT deployed in this phase.

The existing Lambda may be invoked manually after the event infrastructure is configured
and the target is approved. It authenticates with the existing SSM CRON secret and
republishes due Outbox IDs through POST /api/v1/internal/email/process.
Manual invocation is not a harmless read: it can send messages.
Never print the decrypted secret, full event or recipient into logs.
