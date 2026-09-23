import { EmailTemplate, Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type {
  ContactOrderReferenceStatus,
  ContactTopic,
} from '@/types/contact';

type ContactDatabase = Pick<PrismaClient, '$transaction'> & {
  contactInquiry: PrismaClient['contactInquiry'];
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

  public createInquiryWithSupportNotification(
    input: Parameters<ContactRepository['enqueueSupportInquiry']>[0] & {
      publicId: string;
    },
  ) {
    return this.database.$transaction(async (tx) => {
      const existing = await tx.contactInquiry.findUnique({
        where: { submissionId: input.submissionId },
        select: { id: true, publicId: true },
      });
      if (existing) return existing;
      const order =
        input.customerId && input.orderNumber
          ? await tx.order.findFirst({
              where: {
                customerId: input.customerId,
                orderNumber: input.orderNumber,
              },
              select: { id: true },
            })
          : null;
      const inquiry = await tx.contactInquiry.create({
        data: {
          submissionId: input.submissionId,
          publicId: input.publicId,
          topic: input.topic,
          email: input.email,
          message: input.message,
          customerId: input.customerId,
          orderId: order?.id,
          orderNumber: order ? input.orderNumber : undefined,
          createdAt: input.submittedAt,
        },
        select: { id: true, publicId: true },
      });
      await tx.emailOutbox.upsert({
        where: { eventKey: `contact:${input.submissionId}:support` },
        update: {},
        create: this.supportOutboxCreate(input),
      });
      return inquiry;
    });
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
    publicId?: string;
  }) {
    return this.database.emailOutbox.upsert({
      where: { eventKey: `contact:${input.submissionId}:support` },
      update: {},
      create: this.supportOutboxCreate(input),
    });
  }

  private supportOutboxCreate(
    input: Parameters<ContactRepository['enqueueSupportInquiry']>[0],
  ) {
    return {
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
        publicId: input.publicId ?? null,
        loggedIn: Boolean(input.customerId),
        submittedAt: input.submittedAt.toISOString(),
      } as Prisma.InputJsonValue,
    };
  }
}
