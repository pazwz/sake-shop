import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/product-detail';
import { NotFoundError } from '@/lib/errors';
import { ProductService } from '@/services/product.service';
import { productQueryValidator } from '@/validators/product.validator';

const productService = new ProductService();

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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getPublicProduct(slug);
  const category = product.category.parent?.slug ?? product.category.slug;
  const result = await productService.getProducts(
    productQueryValidator.parse({
      category,
      limit: 4,
      sort: 'recommended',
    }),
  );
  const related = result.items.filter((item) => item.slug !== slug).slice(0, 3);

  return <ProductDetail product={product} related={related} />;
}
