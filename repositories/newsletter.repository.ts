import { NewsletterStatus, Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export class NewsletterRepository {
  public constructor(private readonly database: PrismaClient = prisma) {}

  findByEmail(email: string) {
    return this.database.newsletterSubscription.findUnique({
      where: { email },
    });
  }

  getStatus(email: string) {
    return this.database.newsletterSubscription.findUnique({
      where: { email },
      select: { status: true, consentAt: true, unsubscribedAt: true },
    });
  }

  getUnsubscribeStatus(unsubscribeTokenHash: string) {
    return this.database.newsletterSubscription.findUnique({
      where: { unsubscribeTokenHash },
      select: { status: true },
    });
  }

  subscribe(input: {
    id: string;
    email: string;
    tokenHash: string;
    source: string;
    now: Date;
  }) {
    return this.database.$transaction(async (tx) => {
      const current = await tx.newsletterSubscription.findUnique({
        where: { email: input.email },
      });
      if (current?.status === NewsletterStatus.SUBSCRIBED) return current;
      const subscription = await tx.newsletterSubscription.upsert({
        where: { email: input.email },
        update: {
          status: NewsletterStatus.SUBSCRIBED,
          consentAt: input.now,
          unsubscribedAt: null,
          source: input.source,
        },
        create: {
          id: input.id,
          email: input.email,
          status: NewsletterStatus.SUBSCRIBED,
          consentAt: input.now,
          source: input.source,
          unsubscribeTokenHash: input.tokenHash,
        },
      });
      await tx.emailOutbox.upsert({
        where: {
          eventKey: `newsletter-contact:${subscription.id}:subscribe:${input.now.toISOString()}`,
        },
        update: {},
        create: {
          eventKey: `newsletter-contact:${subscription.id}:subscribe:${input.now.toISOString()}`,
          type: 'NEWSLETTER_SUBSCRIBED',
          recipient: input.email,
          subject: 'Newsletter contact synchronization',
          template: 'NEWSLETTER_CONTACT_SYNC',
          payload: { unsubscribed: false },
        },
      });
      return subscription;
    });
  }

  unsubscribe(tokenHash: string, now: Date) {
    return this.database.$transaction(async (tx) => {
      const subscription = await tx.newsletterSubscription.findUnique({
        where: { unsubscribeTokenHash: tokenHash },
      });
      if (!subscription) return null;
      if (subscription.status === NewsletterStatus.UNSUBSCRIBED)
        return subscription;
      const changed = await tx.newsletterSubscription.updateMany({
        where: {
          id: subscription.id,
          status: { not: NewsletterStatus.UNSUBSCRIBED },
        },
        data: { status: NewsletterStatus.UNSUBSCRIBED, unsubscribedAt: now },
      });
      if (changed.count === 0) return subscription;
      await tx.emailOutbox.upsert({
        where: {
          eventKey: `newsletter-contact:${subscription.id}:unsubscribe:${now.toISOString()}`,
        },
        update: {},
        create: {
          eventKey: `newsletter-contact:${subscription.id}:unsubscribe:${now.toISOString()}`,
          type: 'NEWSLETTER_UNSUBSCRIBED',
          recipient: subscription.email,
          subject: 'Newsletter contact synchronization',
          template: 'NEWSLETTER_CONTACT_SYNC',
          payload: { unsubscribed: true },
        },
      });
      return subscription;
    });
  }

  unsubscribeByEmail(email: string, now: Date) {
    return this.database.$transaction(async (tx) => {
      const subscription = await tx.newsletterSubscription.findUnique({
        where: { email },
      });
      if (
        !subscription ||
        subscription.status === NewsletterStatus.UNSUBSCRIBED
      )
        return { unsubscribed: true, changed: false };
      const changed = await tx.newsletterSubscription.updateMany({
        where: {
          id: subscription.id,
          status: { not: NewsletterStatus.UNSUBSCRIBED },
        },
        data: { status: NewsletterStatus.UNSUBSCRIBED, unsubscribedAt: now },
      });
      if (changed.count === 0) return { unsubscribed: true, changed: false };
      await tx.emailOutbox.create({
        data: {
          eventKey: `newsletter-contact:${subscription.id}:unsubscribe:${now.toISOString()}`,
          type: 'NEWSLETTER_UNSUBSCRIBED',
          recipient: subscription.email,
          subject: 'Newsletter contact synchronization',
          template: 'NEWSLETTER_CONTACT_SYNC',
          payload: { unsubscribed: true },
        },
      });
      return { unsubscribed: true, changed: true };
    });
  }
}
