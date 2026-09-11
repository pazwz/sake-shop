import { NextResponse } from 'next/server';
import {
  createAppErrorResponse,
  createErrorResponse,
} from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { AdminProductPreviewService } from '@/services/admin-product-preview.service';
import {
  cmsAdminRoles,
  requireAdmin,
} from '@/services/admin-authorization.service';

const service = new AdminProductPreviewService();

export const runtime = 'nodejs';

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    const admin = await requireAdmin(cmsAdminRoles);
    const path = await service.createPreviewPath((await params).id, admin.id);
    return NextResponse.redirect(new URL(path, request.url));
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'PRODUCT_PREVIEW_FAILED',
      '商品プレビューを開けませんでした。',
      500,
    );
  }
};
