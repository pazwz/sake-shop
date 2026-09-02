import { notFound, redirect } from 'next/navigation';
import { ProductEditor } from '@/components/admin/product-editor';
import { NotFoundError } from '@/lib/errors';
import { sanitizeAdminProductsReturnTo } from '@/lib/admin-product-navigation';
import {
  cmsAdminRoles,
  getCurrentAdmin,
} from '@/services/admin-authorization.service';
import { AdminProductService } from '@/services/admin-product.service';

const service = new AdminProductService();

export default async function AdminProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  if (!cmsAdminRoles.includes(admin.role)) redirect('/admin/products');
  const { id } = await params;
  const returnToParam = (await searchParams).returnTo;
  const returnTo = sanitizeAdminProductsReturnTo(
    Array.isArray(returnToParam) ? returnToParam[0] : returnToParam,
  );
  let product;
  try {
    product = await service.getProduct(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  return <ProductEditor initialProduct={product} returnTo={returnTo} />;
}
