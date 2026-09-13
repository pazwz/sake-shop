# Reservation expiration trigger

Production uses the same secure trigger pattern as the Smaregi scheduler:

```text
EventBridge Scheduler (rate 5 minutes)
  -> Node.js Lambda
  -> POST /api/v1/internal/reservations/expire
```

The Lambda reads the existing `CRON_SECRET` from the existing SSM SecureString
at invocation time. The secret is never stored in Lambda source or logs.

## Production resources

- Lambda: `sake-shop-reservation-expiration-trigger`
- Scheduler: `sake-shop-reservation-expiration-5m`
- Scheduler role: `sake-shop-reservation-expiration-scheduler-role`
- Lambda execution role: existing `sake-shop-smaregi-sync-lambda-role`
- SSM parameter: existing `/sake-shop/smaregi-sync-secret`
- Schedule: `rate(5 minutes)`
- Flexible time window: off
- Maximum event age: 300 seconds
- Maximum retry attempts: 1
- Lambda timeout: 30 seconds
- HTTP timeout: 20 seconds

The Scheduler role is limited to invoking only the reservation-expiration
Lambda. The Lambda execution role is reused because it already has read-only
access to the shared SecureString and CloudWatch Logs permissions.

Deployments must package `index.mjs` as the archive root, update the Lambda,
and verify the Scheduler target and retry policy through read-only AWS CLI
queries. Never add the decrypted parameter value to deployment commands.
