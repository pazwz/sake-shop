import { randomBytes } from 'node:crypto';
import { getContactRuntimeConfig } from '@/config/contact';
import { AppError } from '@/lib/errors';
import { ContactRepository } from '@/repositories/contact.repository';
import { EmailDispatchTriggerService } from '@/services/email-dispatch-trigger.service';
import {
  CONTACT_TOPICS,
  type ContactOrderReferenceStatus,
} from '@/types/contact';
import type { ContactSubmitInput } from '@/validators/contact.validator';

export class ContactService {
  public constructor(
    private readonly contacts = new ContactRepository(),
    private readonly trigger = new EmailDispatchTriggerService(),
  ) {}

  public async submit(input: ContactSubmitInput, customerId?: string) {
    // Honeypot submissions receive an indistinguishable acknowledgement and
    // never reach persistence or the mail provider.
    if (input.website) return { accepted: true };

    const config = getContactRuntimeConfig();
    if (!config.available)
      throw new AppError(
        '現在お問い合わせフォームをご利用いただけません。お電話でお問い合わせください。',
        'CONTACT_UNAVAILABLE',
        503,
      );

    let orderReferenceStatus: ContactOrderReferenceStatus = 'NOT_PROVIDED';
    if (input.orderNumber) {
      orderReferenceStatus =
        customerId &&
        (await this.contacts.hasOrderForCustomerReference(
          customerId,
          input.orderNumber,
        ))
          ? 'VERIFIED'
          : 'UNVERIFIED';
    }

    const submission = {
      submissionId: input.submissionId,
      recipient: config.recipient,
      email: input.email,
      topic: input.topic,
      topicLabel: CONTACT_TOPICS[input.topic],
      message: input.message,
      ...(input.orderNumber ? { orderNumber: input.orderNumber } : {}),
      orderReferenceStatus,
      ...(customerId ? { customerId } : {}),
      submittedAt: new Date(),
    };
    // Keep the legacy method as a narrow test-double compatibility fallback;
    // production repositories always create the inquiry and notification atomically.
    if ('createInquiryWithSupportNotification' in this.contacts) {
      await this.contacts.createInquiryWithSupportNotification({
        ...submission,
        publicId: this.createPublicId(),
      });
    } else {
      await (
        this.contacts as unknown as {
          enqueueSupportInquiry: (value: typeof submission) => Promise<unknown>;
        }
      ).enqueueSupportInquiry(submission);
    }
    await this.trigger.trigger();
    return {
      accepted: true,
      topicLabel: CONTACT_TOPICS[input.topic],
    };
  }

  private createPublicId(now = new Date()) {
    const date = now.toISOString().slice(0, 10).replaceAll('-', '');
    return `INQ-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }
}
