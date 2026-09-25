import { randomBytes } from 'node:crypto';
import { AdminRole, ContactInquiryStatus } from '@prisma/client';
import { getContactRuntimeConfig } from '@/config/contact';
import { ForbiddenError, NotFoundError } from '@/lib/errors';
import { ContactInquiryRepository } from '@/repositories/contact-inquiry.repository';
import { EmailDispatchTriggerService } from '@/services/email-dispatch-trigger.service';
import type { InquiryListInput } from '@/validators/contact-inquiry.validator';

export class ContactInquiryService {
  public constructor(
    private readonly inquiries = new ContactInquiryRepository(),
    private readonly trigger = new EmailDispatchTriggerService(),
  ) {}

  public list(input: InquiryListInput) {
    return this.inquiries.list(input);
  }
  public activeAdmins() {
    return this.inquiries.activeAdmins();
  }
  public countNew() {
    return this.inquiries.countNew();
  }

  public async get(id: string) {
    const inquiry = await this.inquiries.get(id);
    if (!inquiry) throw new NotFoundError('お問い合わせが見つかりません。');
    return inquiry;
  }

  public async getForCustomer(orderId: string, customerId: string) {
    const order = await this.inquiries.findOwnedOrder(orderId, customerId);
    if (!order) throw new ForbiddenError('この注文にはアクセスできません。');
    return this.inquiries.getForCustomer(orderId, customerId);
  }

  public async startOrderSupport(
    orderId: string,
    body: string,
    customerId: string,
  ) {
    const config = getContactRuntimeConfig();
    const result = await this.inquiries.startOrAddCustomerMessage({
      orderId,
      customerId,
      body,
      publicId: this.createPublicId(),
      submissionId: randomBytes(16).toString('hex'),
      adminNotificationRecipient: config.available ? config.recipient : null,
    });
    if (!result) throw new ForbiddenError('この注文にはアクセスできません。');
    if (result.outboxId) await this.trigger.trigger(result.outboxId);
    return result;
  }

  public async addCustomerMessage(
    id: string,
    body: string,
    customerId: string,
  ) {
    const inquiry = await this.inquiries.findOrderIdForCustomerInquiry(
      id,
      customerId,
    );
    if (!inquiry?.orderId)
      throw new ForbiddenError('このメッセージにはアクセスできません。');
    return this.startOrderSupport(inquiry.orderId, body, customerId);
  }

  public async markCustomerRead(id: string, customerId: string) {
    const result = await this.inquiries.markCustomerRead(id, customerId);
    if (!result) throw new ForbiddenError('このメッセージにはアクセスできません。');
  }

  public async assign(
    id: string,
    assignedAdminId: string | null,
    actor: { id: string; role: AdminRole },
  ) {
    if (actor.role === AdminRole.STAFF && assignedAdminId !== actor.id)
      throw new ForbiddenError('担当者は自分自身にのみ設定できます。');
    const result = await this.inquiries.assign(id, assignedAdminId, actor.id);
    if (!result)
      throw new NotFoundError('お問い合わせまたは担当者が見つかりません。');
    return result;
  }

  public async updateStatus(
    id: string,
    status: ContactInquiryStatus,
    actor: { id: string; role: AdminRole },
  ) {
    if (
      status === ContactInquiryStatus.IN_PROGRESS &&
      actor.role === AdminRole.STAFF
    ) {
      const inquiry = await this.get(id);
      if (inquiry.status === ContactInquiryStatus.CLOSED)
        throw new ForbiddenError(
          '完了したお問い合わせを再開する権限がありません。',
        );
    }
    if (
      status === ContactInquiryStatus.IN_PROGRESS &&
      actor.role === AdminRole.STAFF
    ) {
      // STAFF may progress work but cannot reopen CLOSED; repository preserves all other state.
    }
    const result = await this.inquiries.updateStatus(id, status, actor.id);
    if (!result) throw new NotFoundError('お問い合わせが見つかりません。');
    return result;
  }

  public async addNote(id: string, body: string, actorId: string) {
    const note = await this.inquiries.addNote(id, body, actorId);
    if (!note) throw new NotFoundError('お問い合わせが見つかりません。');
    return note;
  }

  public async reply(
    id: string,
    input: { body: string; subject?: string; idempotencyKey: string },
    actorId: string,
  ) {
    const result = await this.inquiries.queueReply({
      inquiryId: id,
      adminId: actorId,
      ...input,
    });
    if (!result) throw new NotFoundError('お問い合わせが見つかりません。');
    await this.trigger.trigger(result.outboxId);
    return result;
  }

  private createPublicId(now = new Date()) {
    const date = now.toISOString().slice(0, 10).replaceAll('-', '');
    return `INQ-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }
}
