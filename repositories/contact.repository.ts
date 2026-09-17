import { EmailTemplate, Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ContactOrderReferenceStatus, ContactTopic } from '@/types/contact';

type ContactDatabase = Pick<PrismaClient, '$transaction'> & {
  emailOutbox: PrismaClient['emailOutbox'];
  order: PrismaClient['order'];
};

export class ContactRepository {
  public constructor(private readonly database: ContactDatabase = prisma) {}

  public async hasOrderForCustomerReference(
    customerId: string,
    orderNumber: string,
  ) {
    return Boolean(
      await this.database.order.findFirst({
        where: { customerId, orderNumber },
        select: { id: true },
      }),
    );
  }

  public enqueueSupportInquiry(input: {
    submissionId: string;
    recipient: string;
    email: string;
    topic: ContactTopic;
    topicLabel: string;
    message: string;
    orderNumber?: string;
    orderReferenceStatus: ContactOrderReferenceStatus;
    customerId?: string;
    submittedAt: Date;
  }) {
    return this.database.emailOutbox.upsert({
      where: { eventKey: `contact:${input.submissionId}:support` },
      update: {},
      create: {
        eventKey: `contact:${input.submissionId}:support`,
        type: 'CONTACT_INQUIRY',
        recipient: input.recipient,
        subject: '[LINXAS EC] お問い合わせ',
        template: EmailTemplate.CONTACT_INQUIRY,
        payload: {
          email: input.email,
          topic: input.topic,
          topicLabel: input.topicLabel,
          message: input.message,
          orderNumber: input.orderNumber ?? null,
          orderReferenceStatus: input.orderReferenceStatus,
          customerId: input.customerId ?? null,
          loggedIn: Boolean(input.customerId),
          submittedAt: input.submittedAt.toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }
}
