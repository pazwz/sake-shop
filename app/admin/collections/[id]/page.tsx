import { notFound, redirect } from 'next/navigation';
import { CollectionForm } from '@/components/admin/collection-form';
import { NotFoundError } from '@/lib/errors';
import {
  cmsAdminRoles,
  getCurrentAdmin,
} from '@/services/admin-authorization.service';
import { FeaturedCollectionService } from '@/services/collection.service';

const collectionService = new FeaturedCollectionService();

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  if (!cmsAdminRoles.includes(admin.role)) redirect('/admin/collections');

  const { id } = await params;
  let collection;
  try {
    collection = await collectionService.getAdminCollection(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <main className="wrap py-16">
      <CollectionForm
        collection={{
          id: collection.id,
          type: collection.type,
          season: collection.season,
          title: collection.title,
          subtitle: collection.subtitle,
          description: collection.description,
          desktopImageUrl: collection.desktopImageUrl,
          mobileImageUrl: collection.mobileImageUrl,
          status: collection.status,
          publishStartAt: collection.publishStartAt?.toISOString() ?? null,
          publishEndAt: collection.publishEndAt?.toISOString() ?? null,
          displayOrder: collection.displayOrder,
          products: collection.products.map(({ product }) => ({
            product: {
              id: product.id,
              name: product.name,
              slug: product.slug,
              producer: product.producer,
            },
          })),
        }}
      />
    </main>
  );
}
