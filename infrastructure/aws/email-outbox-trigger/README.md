# Email outbox trigger

`sake-shop-email-outbox-trigger` is invoked by the
`sake-shop-email-outbox-2m` EventBridge Scheduler. It reads the existing
`CRON_SECRET` SSM SecureString and calls
`POST /api/v1/internal/email/process` every two minutes.

The Lambda logs only HTTP status and aggregate processing counts. It never logs
the Authorization header, recipient, token, API key, or message body. The
Scheduler uses a dedicated least-privilege role, retries once, and discards
events older than 300 seconds.
