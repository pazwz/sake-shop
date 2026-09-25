import { ContactInquiryMessageDirection, Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';

const activeAnnouncementWhere = (now: Date): Prisma.SiteAnnouncementWhereInput => ({
  isPublished: true,
  publishedAt: { lte: now },
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

export class CustomerNotificationRepository {
  public constructor(private readonly database: PrismaClient = prisma) {}

  public orderThreads(customerId: string) {
    return this.database.contactInquiry.findMany({
      where: { orderId: { not: null }, order: { is: { customerId } } },
      select: {
        id: true,
        orderNumber: true,
        customerLastReadAt: true,
        messages: {
          where: { direction: ContactInquiryMessageDirection.ADMIN },
          orderBy: { createdAt: 'desc' }, take: 1,
          select: { body: true, createdAt: true },
        },
      },
    });
  }

  public activeAnnouncements(customerId: string, now: Date) {
    return this.database.siteAnnouncement.findMany({
      where: activeAnnouncementWhere(now),
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, title: true, body: true, type: true, publishedAt: true,
        reads: { where: { customerId }, select: { readAt: true }, take: 1 },
      },
    });
  }

  public activeAnnouncement(id: string, now: Date) {
    return this.database.siteAnnouncement.findFirst({
      where: { id, ...activeAnnouncementWhere(now) },
      select: { id: true, title: true, body: true, type: true, publishedAt: true },
    });
  }

  public markAnnouncementRead(customerId: string, announcementId: string) {
    return this.database.customerAnnouncementRead.upsert({
      where: { customerId_announcementId: { customerId, announcementId } },
      create: { customerId, announcementId }, update: { readAt: new Date() },
    });
  }
}
