import { NotFoundError } from '@/lib/errors';
import { SiteAnnouncementRepository } from '@/repositories/site-announcement.repository';
import type { SiteAnnouncementInput } from '@/validators/site-announcement.validator';
export class SiteAnnouncementService { public constructor(private readonly repository = new SiteAnnouncementRepository()) {} list() { return this.repository.list(); } async get(id: string) { const item = await this.repository.get(id); if (!item) throw new NotFoundError('お知らせが見つかりません。'); return item; } create(input: SiteAnnouncementInput) { return this.repository.create(input); } async update(id: string, input: SiteAnnouncementInput) { await this.get(id); return this.repository.update(id, input); } }
