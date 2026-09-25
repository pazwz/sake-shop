import { type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { SiteAnnouncementInput } from '@/validators/site-announcement.validator';
export class SiteAnnouncementRepository { public constructor(private readonly database: PrismaClient = prisma) {} list() { return this.database.siteAnnouncement.findMany({ orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }] }); } get(id: string) { return this.database.siteAnnouncement.findUnique({ where: { id } }); } create(input: SiteAnnouncementInput) { return this.database.siteAnnouncement.create({ data: input }); } update(id: string, input: SiteAnnouncementInput) { return this.database.siteAnnouncement.update({ where: { id }, data: input }); } }
