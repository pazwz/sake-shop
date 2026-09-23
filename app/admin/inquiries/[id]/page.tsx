import { notFound, redirect } from 'next/navigation';
import { InquiryDetail } from '@/components/admin/inquiry-detail';
import { NotFoundError } from '@/lib/errors';
import { getCurrentAdmin } from '@/services/admin-authorization.service';
import { ContactInquiryService } from '@/services/contact-inquiry.service';
export const dynamic = 'force-dynamic';
export default async function InquiryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  const service = new ContactInquiryService();
  let inquiry;
  let admins;
  try {
    [inquiry, admins] = await Promise.all([
      service.get((await params).id),
      service.activeAdmins(),
    ]);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  return (
    <main className="wrap py-16">
      <InquiryDetail inquiry={inquiry} admins={admins} currentAdmin={admin} />
    </main>
  );
}
