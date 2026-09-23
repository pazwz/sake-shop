import {
  ContactInquiryStatus,
  ContactInquiryMessageDirection,
  EmailTemplate,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { InquiryListInput } from '@/validators/contact-inquiry.validator';

const pageSize = 25;

const inquirySelect = {
  id: true,
  publicId: true,
  status: true,
  topic: true,
  name: true,
  email: true,
  orderNumber: true,
  assignedAdminId: true,
  createdAt: true,
  updatedAt: true,
  firstRespondedAt: true,
  closedAt: true,
  assignedAdmin: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
} satisfies Prisma.ContactInquirySelect;

export class ContactInquiryRepository {
  public constructor(private readonly database: PrismaClient = prisma) {}

  public async list(input: InquiryListInput) {
    const where: Prisma.ContactInquiryWhereInput = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.assignedAdminId
        ? { assignedAdminId: input.assignedAdminId }
        : {}),
      ...(input.topic ? { topic: input.topic } : {}),
      ...(input.q
        ? {
            OR: [
              { publicId: { contains: input.q, mode: 'insensitive' } },
              { email: { contains: input.q, mode: 'insensitive' } },
              { orderNumber: { contains: input.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, items] = await this.database.$transaction([
      this.database.contactInquiry.count({ where }),
      this.database.contactInquiry.findMany({
        where,
        select: inquirySelect,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (input.page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items,
      pagination: {
        page: input.page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  public get(id: string) {
    return this.database.contactInquiry.findUnique({
      where: { id },
      select: {
        ...inquirySelect,
        message: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            direction: true,
            subject: true,
            body: true,
            createdAt: true,
            emailOutbox: {
              select: { status: true, sentAt: true, lastError: true },
            },
            authorAdmin: { select: { name: true } },
          },
        },
        notes: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            body: true,
            createdAt: true,
            admin: { select: { name: true } },
          },
        },
        order: { select: { id: true, orderNumber: true } },
      },
    });
  }

  public activeAdmins() {
    return this.database.adminUser.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  public async assign(
    id: string,
    assignedAdminId: string | null,
    actorId: string,
  ) {
    return this.database.$transaction(async (tx) => {
      if (assignedAdminId) {
        const target = await tx.adminUser.findFirst({
          where: { id: assignedAdminId, isActive: true },
          select: { id: true },
        });
        if (!target) return null;
      }
      const inquiry = await tx.contactInquiry.findUnique({
        where: { id },
        select: { status: true, publicId: true },
      });
      if (!inquiry) return null;
      const status =
        assignedAdminId && inquiry.status === ContactInquiryStatus.NEW
          ? ContactInquiryStatus.IN_PROGRESS
          : inquiry.status;
      const updated = await tx.contactInquiry.update({
        where: { id },
        data: { assignedAdminId, status },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: actorId,
          action: 'INQUIRY_ASSIGNED',
          entityType: 'ContactInquiry',
          entityId: id,
          afterData: {
            publicId: inquiry.publicId,
            assignedAdminId,
            fromStatus: inquiry.status,
            toStatus: status,
          },
        },
      });
      return updated;
    });
  }

  public async updateStatus(
    id: string,
    status: ContactInquiryStatus,
    actorId: string,
  ) {
    return this.database.$transaction(async (tx) => {
      const current = await tx.contactInquiry.findUnique({
        where: { id },
        select: { status: true, publicId: true },
      });
      if (!current) return null;
      const updated = await tx.contactInquiry.update({
        where: { id },
        data: {
          status,
          closedAt: status === ContactInquiryStatus.CLOSED ? new Date() : null,
        },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: actorId,
          action: 'INQUIRY_STATUS_CHANGED',
          entityType: 'ContactInquiry',
          entityId: id,
          afterData: {
            publicId: current.publicId,
            fromStatus: current.status,
            toStatus: status,
          },
        },
      });
      return updated;
    });
  }

  public async addNote(id: string, body: string, adminId: string) {
    return this.database.$transaction(async (tx) => {
      const inquiry = await tx.contactInquiry.findUnique({
        where: { id },
        select: { publicId: true },
      });
      if (!inquiry) return null;
      const note = await tx.contactInquiryNote.create({
        data: { inquiryId: id, adminId, body },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: adminId,
          action: 'INQUIRY_NOTE_CREATED',
          entityType: 'ContactInquiry',
          entityId: id,
          afterData: { publicId: inquiry.publicId, noteId: note.id },
        },
      });
      return note;
    });
  }

  public async queueReply(input: {
    inquiryId: string;
    adminId: string;
    body: string;
    subject?: string;
    idempotencyKey: string;
  }) {
    return this.database.$transaction(async (tx) => {
      const inquiry = await tx.contactInquiry.findUnique({
        where: { id: input.inquiryId },
        select: {
          id: true,
          publicId: true,
          email: true,
          name: true,
          status: true,
          firstRespondedAt: true,
        },
      });
      if (!inquiry) return null;
      const eventKey = `contact-reply:${inquiry.id}:${input.idempotencyKey}`;
      const existing = await tx.emailOutbox.findUnique({
        where: { eventKey },
        select: { id: true },
      });
      if (existing) return { outboxId: existing.id, duplicate: true };
      const subject =
        input.subject ??
        `Re: [LINXAS] お問い合わせについて（${inquiry.publicId}）`;
      const outbox = await tx.emailOutbox.create({
        data: {
          eventKey,
          type: 'CONTACT_REPLY',
          recipient: inquiry.email,
          subject,
          template: EmailTemplate.CONTACT_REPLY,
          payload: {
            publicId: inquiry.publicId,
            customerName: inquiry.name ?? 'お客様',
            body: input.body,
            subject,
          },
        },
      });
      const message = await tx.contactInquiryMessage.create({
        data: {
          inquiryId: inquiry.id,
          direction: ContactInquiryMessageDirection.ADMIN,
          authorAdminId: input.adminId,
          fromEmail: '',
          toEmail: inquiry.email,
          subject,
          body: input.body,
          emailOutboxId: outbox.id,
        },
      });
      await tx.contactInquiry.update({
        where: { id: inquiry.id },
        data: {
          status:
            inquiry.status === ContactInquiryStatus.CLOSED
              ? ContactInquiryStatus.CLOSED
              : ContactInquiryStatus.ANSWERED,
          firstRespondedAt: inquiry.firstRespondedAt ?? new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: input.adminId,
          action: 'INQUIRY_REPLIED',
          entityType: 'ContactInquiry',
          entityId: inquiry.id,
          afterData: { publicId: inquiry.publicId, messageId: message.id },
        },
      });
      return { outboxId: outbox.id, duplicate: false };
    });
  }

  public countNew() {
    return this.database.contactInquiry.count({
      where: { status: ContactInquiryStatus.NEW },
    });
  }
}
