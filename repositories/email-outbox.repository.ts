import {
  EmailOutboxStatus,
  NewsletterStatus,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { EmailOutboxDraft } from '@/types/email';

type EmailDatabase = PrismaClient | Prisma.TransactionClient;

export class EmailOutboxRepository {
  public constructor(private readonly database: EmailDatabase = prisma) {}

  public enqueue(draft: EmailOutboxDraft) {
    return this.database.emailOutbox.upsert({
      where: { eventKey: draft.eventKey },
      update: {},
      create: {
        ...draft,
        payload: draft.payload as Prisma.InputJsonValue,
      },
    });
  }

  public async claimDue(
    limit: number,
    now = new Date(),
    staleBefore = new Date(now.getTime() - 10 * 60 * 1000),
  ) {
    const candidates = await this.database.emailOutbox.findMany({
      where: {
        OR: [
          {
            status: {
              in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.FAILED],
            },
            nextAttemptAt: { lte: now },
          },
          {
            status: EmailOutboxStatus.SENDING,
            lockedAt: { lte: staleBefore },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    const claimed = [];
    for (const candidate of candidates) {
      const result = await this.database.emailOutbox.updateMany({
        where: {
          id: candidate.id,
          status: candidate.status,
          ...(candidate.status === EmailOutboxStatus.SENDING
            ? { lockedAt: candidate.lockedAt }
            : { nextAttemptAt: candidate.nextAttemptAt }),
        },
        data: { status: EmailOutboxStatus.SENDING, lockedAt: now },
      });
      if (result.count === 1) claimed.push(candidate);
    }
    return claimed;
  }

  public markSent(id: string, provider: string, providerMessageId: string) {
    return this.database.emailOutbox.update({
      where: { id },
      data: {
        status: EmailOutboxStatus.SENT,
        provider,
        providerMessageId,
        sentAt: new Date(),
        nextAttemptAt: null,
        lockedAt: null,
        lastError: null,
        attemptCount: { increment: 1 },
      },
    });
  }

  public markFailed(id: string, lastError: string, nextAttemptAt: Date | null) {
    return this.database.emailOutbox.update({
      where: { id },
      data: {
        status: EmailOutboxStatus.FAILED,
        lastError: lastError.slice(0, 250),
        nextAttemptAt,
        lockedAt: null,
        attemptCount: { increment: 1 },
      },
    });
  }

  public markSkipped(id: string, reason: string) {
    return this.database.emailOutbox.update({
      where: { id },
      data: {
        status: EmailOutboxStatus.SKIPPED,
        nextAttemptAt: null,
        lockedAt: null,
        lastError: reason.slice(0, 250),
      },
    });
  }

  public markContactSynced(email: string, resendContactId: string) {
    return this.database.newsletterSubscription.updateMany({
      where: { email: email.toLowerCase() },
      data: { resendContactId },
    });
  }

  public async recordWebhook(input: {
    providerEventId: string;
    type: string;
    payloadHash: string;
    providerMessageId?: string;
    recipient?: string;
    contactUnsubscribed?: boolean;
  }) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.emailWebhookEvent.findUnique({
          where: { providerEventId: input.providerEventId },
        });
        if (existing) return { duplicate: true };
        await tx.emailWebhookEvent.create({
          data: {
            providerEventId: input.providerEventId,
            type: input.type,
            payloadHash: input.payloadHash,
          },
        });
        if (input.providerMessageId) {
          await tx.emailOutbox.updateMany({
            where: { providerMessageId: input.providerMessageId },
            data: {
              deliveryStatus: input.type,
              ...(input.type === 'email.delivered'
                ? { deliveredAt: new Date() }
                : {}),
            },
          });
        }
        if (
          input.recipient &&
          ['email.bounced', 'email.complained', 'email.suppressed'].includes(
            input.type,
          )
        ) {
          await tx.newsletterSubscription.updateMany({
            where: { email: input.recipient.toLowerCase() },
            data: {
              status: NewsletterStatus.SUPPRESSED,
              unsubscribedAt: new Date(),
            },
          });
        }
        if (
          input.type === 'contact.updated' &&
          input.recipient &&
          input.contactUnsubscribed === true
        ) {
          await tx.newsletterSubscription.updateMany({
            where: { email: input.recipient.toLowerCase() },
            data: {
              status: NewsletterStatus.UNSUBSCRIBED,
              unsubscribedAt: new Date(),
            },
          });
        }
        return { duplicate: false };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return { duplicate: true };
      throw error;
    }
  }
}
