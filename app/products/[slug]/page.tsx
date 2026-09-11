import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/product-detail';
import { NotFoundError } from '@/lib/errors';
import { ProductService } from '@/services/product.service';
import { AdminProductPreviewService } from '@/services/admin-product-preview.service';
import {
  cmsAdminRoles,
  getCurrentAdmin,
} from '@/services/admin-authorization.service';
import { productQueryValidator } from '@/validators/product.validator';

const productService = new ProductService();
const previewService = new AdminProductPreviewService();

const getPublicProduct = async (slug: string) => {
  try {
    return await productService.getProductBySlug(slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
};

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const previewParam = (await searchParams).previewToken;
  const previewToken = Array.isArray(previewParam)
    ? previewParam[0]
    : previewParam;
  let previewMode = false;
  let product;
  if (previewToken) {
    const admin = await getCurrentAdmin();
    if (!admin || !cmsAdminRoles.includes(admin.role)) notFound();
    try {
      product = await previewService.getPreviewProduct(
        slug,
        previewToken,
        admin.id,
      );
      previewMode = true;
    } catch (error) {
      if (error instanceof NotFoundError) notFound();
      throw error;
    }
  } else {
    product = await getPublicProduct(slug);
  }
  const category = product.category.parent?.slug ?? product.category.slug;
  const result = await productService.getProducts(
    productQueryValidator.parse({
      category,
      limit: 4,
      sort: 'recommended',
    }),
  );
  const related = result.items.filter((item) => item.slug !== slug).slice(0, 3);

  return (
    <ProductDetail
      product={product}
      related={related}
      previewMode={previewMode}
    />
  );
}
