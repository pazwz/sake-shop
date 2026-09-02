import { notFound, redirect } from 'next/navigation';
import { ProductEditor } from '@/components/admin/product-editor';
import { NotFoundError } from '@/lib/errors';
import {
  cmsAdminRoles,
  getCurrentAdmin,
} from '@/services/admin-authorization.service';
import { AdminProductService } from '@/services/admin-product.service';

const service = new AdminProductService();

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');
  if (!cmsAdminRoles.includes(admin.role)) redirect('/admin/products');
  const { id } = await params;
  let product;
  try {
    product = await service.getProduct(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  return <ProductEditor initialProduct={product} />;
}
