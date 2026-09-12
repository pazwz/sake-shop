import { notFound, redirect } from 'next/navigation';
import { CollectionForm } from '@/components/admin/collection-form';
import { EditorialSectionEditor } from '@/components/admin/editorial-section-editor';
import { NotFoundError } from '@/lib/errors';
import {
  cmsAdminRoles,
  getCurrentAdmin,
} from '@/services/admin-authorization.service';
import { FeaturedCollectionService } from '@/services/collection.service';
import { isStandaloneEcProduct } from '@/services/product-visibility.service';

const collectionService = new FeaturedCollectionService();

export default async function CollectionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  if (!cmsAdminRoles.includes(admin.role)) redirect('/admin/collections');

  const [{ id }, query] = await Promise.all([params, searchParams]);
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
        initialSaved={query.saved === '1'}
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
          displayOrder: collection.displayOrder,
          products: collection.products.map(({ product }) => ({
            product: {
              id: product.id,
              name: product.name,
              slug: product.slug,
              productCode: product.productCode,
              producer: product.producer,
              isActive: product.isActive,
              isEcAvailable: product.isEcAvailable,
              isEligible:
                product.isActive &&
                product.isEcAvailable &&
                isStandaloneEcProduct(product),
              category: {
                id: product.category.id,
                name: product.category.name,
                slug: product.category.slug,
              },
            },
          })),
        }}
      />
      {collection.type === 'EDITORIAL' ? (
        <EditorialSectionEditor
          collectionId={collection.id}
          initialSections={collection.editorialSections.map((section) => ({
            id: section.id,
            title: section.title,
            body: section.body,
            imageUrl: section.imageUrl,
            productId: section.productId,
          }))}
        />
      ) : null}
    </main>
  );
}
