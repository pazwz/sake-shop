import { Resend } from 'resend';

export class ResendMarketingContactService {
  public async sync(input: { email: string; unsubscribed: boolean }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_CONFIGURATION_MISSING');
    const resend = new Resend(apiKey);
    const created = await resend.contacts.create(input);
    if (created.data?.id) return { contactId: created.data.id };
    const updated = await resend.contacts.update(input);
    if (updated.error || !updated.data?.id)
      throw new Error(updated.error?.name ?? 'RESEND_CONTACT_SYNC_FAILED');
    return { contactId: updated.data.id };
  }
}
