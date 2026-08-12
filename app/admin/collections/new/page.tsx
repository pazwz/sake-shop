import { redirect } from 'next/navigation';
import { CollectionForm } from '@/components/admin/collection-form';
import {
  cmsAdminRoles,
  getCurrentAdmin,
} from '@/services/admin-authorization.service';

const allowedTypes = new Set([
  'HERO',
  'SEASONAL',
  'SHOPKEEPER',
  'GIFT',
  'EDITORIAL',
  'STORY',
]);
const allowedSeasons = new Set(['SPRING', 'SUMMER', 'AUTUMN', 'WINTER']);

export default async function NewCollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; season?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  if (!cmsAdminRoles.includes(admin.role)) redirect('/admin/collections');

  const query = await searchParams;
  const initialType =
    query.type && allowedTypes.has(query.type) ? query.type : 'HERO';
  const initialSeason =
    query.season && allowedSeasons.has(query.season) ? query.season : null;

  return (
    <main className="wrap py-16">
      <CollectionForm
        initialType={initialType}
        initialSeason={initialSeason}
      />
    </main>
  );
}
