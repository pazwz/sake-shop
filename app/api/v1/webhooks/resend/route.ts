import { Resend, type WebhookEventPayload } from 'resend';
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response';
import { EmailOutboxService } from '@/services/email-outbox.service';

export const runtime = 'nodejs';

const recipientFrom = (event: WebhookEventPayload) =>
  'to' in event.data && Array.isArray(event.data.to)
    ? event.data.to[0]
    : 'email' in event.data
      ? event.data.email
      : undefined;

export const POST = async (request: Request) => {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret)
    return createErrorResponse(
      'RESEND_WEBHOOK_UNAVAILABLE',
      'Webhook is not configured.',
      503,
    );
  const rawPayload = await request.text();
  try {
    const event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({
      payload: rawPayload,
      headers: {
        id: request.headers.get('svix-id') ?? '',
        timestamp: request.headers.get('svix-timestamp') ?? '',
        signature: request.headers.get('svix-signature') ?? '',
      },
      webhookSecret,
    });
    const providerMessageId =
      'email_id' in event.data ? String(event.data.email_id) : undefined;
    return createSuccessResponse(
      await new EmailOutboxService().recordWebhook({
        providerEventId: request.headers.get('svix-id')!,
        type: event.type,
        rawPayload,
        providerMessageId,
        recipient: recipientFrom(event),
        contactUnsubscribed:
          'unsubscribed' in event.data ? event.data.unsubscribed : undefined,
      }),
    );
  } catch {
    return createErrorResponse(
      'INVALID_RESEND_WEBHOOK',
      'Webhook signature is invalid.',
      401,
    );
  }
};
