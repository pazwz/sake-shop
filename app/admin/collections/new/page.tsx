import { redirect } from 'next/navigation';
import { CollectionForm } from '@/components/admin/collection-form';
import {
  cmsAdminRoles,
  getCurrentAdmin,
} from '@/services/admin-authorization.service';

export default async function NewCollectionPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  if (!cmsAdminRoles.includes(admin.role)) redirect('/admin/collections');

  return (
    <main className="wrap py-16">
      <CollectionForm />
    </main>
  );
}
