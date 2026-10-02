import {
  ContactInquiryMessageDirection,
  ContactInquiryStatus,
  EmailTemplate,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ValidationError } from '@/lib/errors';
import type { InquiryListInput } from '@/validators/contact-inquiry.validator';

const pageSize = 25;

const unreadInquirySql = (adminId: string) => Prisma.sql`EXISTS (
  SELECT 1 FROM contact_inquiry_messages unread_message
  WHERE unread_message.inquiry_id = i.id AND unread_message.direction = 'CUSTOMER'
  AND NOT EXISTS (SELECT 1 FROM admin_inquiry_message_reads read_marker
    WHERE read_marker.admin_id = ${adminId} AND read_marker.message_id = unread_message.id)
)`;

const inquirySelect = {
  id: true,
  publicId: true,
  status: true,
  topic: true,
  name: true,
  message: true,
  email: true,
  orderNumber: true,
  assignedAdminId: true,
  createdAt: true,
  updatedAt: true,
  firstRespondedAt: true,
  closedAt: true,
  assignedAdmin: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  messages: {
    take: 1,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { createdAt: true, direction: true, body: true },
  },
} satisfies Prisma.ContactInquirySelect;

const threadSelect = {
  id: true,
  publicId: true,
  status: true,
  topic: true,
  orderId: true,
  orderNumber: true,
  createdAt: true,
  updatedAt: true,
  customerLastReadAt: true,
  messages: {
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      direction: true,
      body: true,
      createdAt: true,
      authorAdmin: { select: { name: true } },
    },
  },
} satisfies Prisma.ContactInquirySelect;

export class ContactInquiryRepository {
  public constructor(private readonly database: PrismaClient = prisma) {}

  public async list(input: InquiryListInput, adminId: string) {
    const conditions = [Prisma.sql`TRUE`];
    if (input.status)
      conditions.push(Prisma.sql`i.status::text = ${input.status}`);
    if (input.assignedAdminId)
      conditions.push(
        Prisma.sql`i.assigned_admin_id = ${input.assignedAdminId}`,
      );
    if (input.topic) conditions.push(Prisma.sql`i.topic = ${input.topic}`);
    if (input.q) {
      const search = `%${input.q.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(
        Prisma.sql`(i.public_id ILIKE ${search} OR i.email ILIKE ${search} OR i.order_number ILIKE ${search})`,
      );
    }
    const where = Prisma.join(conditions, ' AND ');
    const unread = unreadInquirySql(adminId);
    const [count, ranked] = await this.database.$transaction([
      this.database.$queryRaw<Array<{ total: bigint }>>(
        Prisma.sql`SELECT COUNT(*) AS total FROM contact_inquiries i WHERE ${where}`,
      ),
      this.database.$queryRaw<
        Array<{ id: string; unread: boolean }>
      >(Prisma.sql`
        SELECT i.id, ${unread} AS unread FROM contact_inquiries i
        LEFT JOIN LATERAL (SELECT direction, created_at FROM contact_inquiry_messages m
          WHERE m.inquiry_id = i.id ORDER BY created_at DESC, id DESC LIMIT 1) latest ON TRUE
        WHERE ${where}
        ORDER BY CASE
          WHEN i.status = 'CLOSED' THEN 3
          WHEN ${unread} AND latest.direction = 'CUSTOMER' THEN 0
          WHEN i.status IN ('NEW', 'IN_PROGRESS') AND latest.direction = 'CUSTOMER' THEN 1
          ELSE 2 END,
          COALESCE(latest.created_at, i.created_at) DESC, i.id
        LIMIT ${pageSize} OFFSET ${(input.page - 1) * pageSize}`),
    ]);
    const total = Number(count[0].total);
    const items = ranked.length
      ? await this.database.contactInquiry.findMany({
          where: { id: { in: ranked.map((row) => row.id) } },
          select: inquirySelect,
        })
      : [];
    const byId = new Map(items.map((item) => [item.id, item]));
    return {
      // Hydrate only the DB-paginated IDs; priority/order is never computed in JS.
      items: ranked.map((row) => {
        const { messages, ...inquiry } = byId.get(row.id)!;
        return {
          ...inquiry,
          unread: row.unread,
          lastMessageAt: messages[0]?.createdAt ?? inquiry.createdAt,
          lastDirection: messages[0]?.direction ?? null,
          lastMessagePreview: (
            messages[0]?.body ??
            inquiry.message ??
            ''
          ).slice(0, 120),
        };
      }),
      pagination: {
        page: input.page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  public async unreadSummary(adminId: string) {
    const unread = unreadInquirySql(adminId);
    const [count, recent] = await this.database.$transaction([
      this.database.$queryRaw<Array<{ total: bigint }>>(
        Prisma.sql`SELECT COUNT(*) AS total FROM contact_inquiries i WHERE ${unread}`,
      ),
      this.database.$queryRaw<
        Array<{
          id: string;
          publicId: string;
          orderNumber: string | null;
          customerName: string | null;
          preview: string;
          createdAt: Date;
        }>
      >(Prisma.sql`
        SELECT i.id, i.public_id AS "publicId", i.order_number AS "orderNumber",
          c.name AS "customerName", LEFT(latest.body, 120) AS preview, latest.created_at AS "createdAt"
        FROM contact_inquiries i LEFT JOIN customers c ON c.id = i.customer_id
        JOIN LATERAL (SELECT m.body, m.created_at FROM contact_inquiry_messages m
          WHERE m.inquiry_id = i.id AND m.direction = 'CUSTOMER'
          AND NOT EXISTS (SELECT 1 FROM admin_inquiry_message_reads r WHERE r.admin_id = ${adminId} AND r.message_id = m.id)
          ORDER BY m.created_at DESC, m.id DESC LIMIT 1) latest ON TRUE
        ORDER BY latest.created_at DESC, i.id LIMIT 5`),
    ]);
    return { unreadInquiryCount: Number(count[0].total), recent };
  }

  public async markAdminRead(
    inquiryId: string,
    messageIds: string[],
    adminId: string,
  ) {
    const ids = [...new Set(messageIds)];
    const displayed = await this.database.contactInquiryMessage.findMany({
      where: {
        id: { in: ids },
        inquiryId,
        direction: ContactInquiryMessageDirection.CUSTOMER,
      },
      select: { id: true },
    });
    if (displayed.length !== ids.length)
      throw new ValidationError(
        '表示されたお客様のメッセージのみ既読にできます。',
      );
    return this.database.adminInquiryMessageRead.createMany({
      data: displayed.map(({ id }) => ({ adminId, messageId: id })),
      skipDuplicates: true,
    });
  }

  public get(id: string) {
    return this.database.contactInquiry.findUnique({
      where: { id },
      select: {
        ...threadSelect,
        name: true,
        email: true,
        message: true,
        assignedAdminId: true,
        assignedAdmin: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
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

  public getForCustomer(orderId: string, customerId: string) {
    return this.database.contactInquiry.findFirst({
      where: { orderId, order: { is: { customerId } } },
      select: threadSelect,
    });
  }

  public findOrderIdForCustomerInquiry(id: string, customerId: string) {
    return this.database.contactInquiry.findFirst({
      where: { id, order: { is: { customerId } } },
      select: { orderId: true },
    });
  }

  public async markCustomerRead(id: string, customerId: string) {
    const owned = await this.database.contactInquiry.findFirst({
      where: { id, orderId: { not: null }, order: { is: { customerId } } },
      select: { id: true },
    });
    if (!owned) return null;
    return this.database.contactInquiry.update({
      where: { id: owned.id },
      data: { customerLastReadAt: new Date() },
      select: { id: true },
    });
  }

  public findOwnedOrder(id: string, customerId: string) {
    return this.database.order.findFirst({
      where: { id, customerId },
      select: {
        id: true,
        orderNumber: true,
        customer: { select: { name: true, email: true } },
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

  public async startOrAddCustomerMessage(input: {
    orderId: string;
    customerId: string;
    publicId: string;
    submissionId: string;
    body: string;
    adminNotificationRecipient: string | null;
  }) {
    return this.database.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: input.orderId, customerId: input.customerId },
        select: {
          id: true,
          orderNumber: true,
          customer: { select: { name: true, email: true } },
        },
      });
      if (!order) return null;
      const inquiry = await tx.contactInquiry.upsert({
        where: { orderId: order.id },
        create: {
          submissionId: input.submissionId,
          publicId: input.publicId,
          topic: 'ORDER_SUPPORT',
          name: order.customer.name,
          email: order.customer.email,
          message: input.body,
          customerId: input.customerId,
          orderId: order.id,
          orderNumber: order.orderNumber,
        },
        update: {},
        select: { id: true, publicId: true, status: true },
      });
      const nextStatus =
        inquiry.status === ContactInquiryStatus.ANSWERED ||
        inquiry.status === ContactInquiryStatus.CLOSED
          ? ContactInquiryStatus.IN_PROGRESS
          : inquiry.status;
      const message = await tx.contactInquiryMessage.create({
        data: {
          inquiryId: inquiry.id,
          direction: ContactInquiryMessageDirection.CUSTOMER,
          authorCustomerId: input.customerId,
          fromEmail: order.customer.email,
          toEmail: '',
          subject: `注文についてのお問い合わせ（${order.orderNumber}）`,
          body: input.body,
        },
        select: { id: true },
      });
      await tx.contactInquiry.update({
        where: { id: inquiry.id },
        data: { status: nextStatus, closedAt: null },
      });
      if (!input.adminNotificationRecipient)
        return {
          inquiryId: inquiry.id,
          outboxId: null,
          created: inquiry.publicId === input.publicId,
        };
      const outbox = await tx.emailOutbox.create({
        data: {
          eventKey: `order-support:${order.id}:customer-message:${message.id}`,
          type: 'CONTACT_INQUIRY',
          recipient: input.adminNotificationRecipient,
          subject: '[LINXAS EC] 新しいお問い合わせがあります',
          template: EmailTemplate.CONTACT_INQUIRY,
          payload: {
            publicId: inquiry.publicId,
            orderNumber: order.orderNumber,
            siteOnly: true,
          },
        },
        select: { id: true },
      });
      await tx.contactInquiryMessage.update({
        where: { id: message.id },
        data: { emailOutboxId: outbox.id },
      });
      return {
        inquiryId: inquiry.id,
        outboxId: outbox.id,
        created: inquiry.publicId === input.publicId,
      };
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
          orderId: true,
          orderNumber: true,
        },
      });
      if (!inquiry) return null;
      const eventKey = `order-support:reply:${inquiry.id}:${input.idempotencyKey}`;
      const existing = await tx.emailOutbox.findUnique({
        where: { eventKey },
        select: { id: true },
      });
      if (existing) return { outboxId: existing.id, duplicate: true };
      const orderLinked = Boolean(inquiry.orderId && inquiry.orderNumber);
      const subject = orderLinked
        ? '【LINXAS】新しいメッセージがあります'
        : (input.subject ??
          `Re: [LINXAS] お問い合わせについて（${inquiry.publicId}）`);
      const template = orderLinked
        ? EmailTemplate.ORDER_MESSAGE_NOTIFICATION
        : EmailTemplate.CONTACT_REPLY;
      const outbox = await tx.emailOutbox.create({
        data: {
          eventKey,
          type: orderLinked ? 'ORDER_MESSAGE_NOTIFICATION' : 'CONTACT_REPLY',
          recipient: inquiry.email,
          subject,
          template,
          payload: orderLinked
            ? {
                customerName: inquiry.name ?? 'お客様',
                orderNumber: inquiry.orderNumber,
                orderId: inquiry.orderId,
              }
            : {
                publicId: inquiry.publicId,
                customerName: inquiry.name ?? 'お客様',
                body: input.body,
                subject,
              },
        },
        select: { id: true },
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
          status: ContactInquiryStatus.ANSWERED,
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
