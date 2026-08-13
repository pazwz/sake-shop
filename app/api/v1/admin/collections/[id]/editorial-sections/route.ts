import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import {
  cmsAdminRoles,
  requireAdmin,
} from '@/services/admin-authorization.service';
import { FeaturedCollectionService } from '@/services/collection.service';
import { editorialSectionsValidator } from '@/validators/collection.validator';

const collectionService = new FeaturedCollectionService();

const toEditorialSectionResponse = (sections: Array<{
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  productId: string | null;
  displayOrder: number;
}>) =>
  sections.map((section) => ({
    id: section.id,
    title: section.title,
    body: section.body,
    imageUrl: section.imageUrl,
    productId: section.productId,
    displayOrder: section.displayOrder,
  }));

const handleError = (error: unknown) => {
  if (error instanceof AppError) return createAppErrorResponse(error);
  if (error instanceof ZodError) {
    return createAppErrorResponse(new ValidationError());
  }
  return createErrorResponse(
    'INTERNAL_SERVER_ERROR',
    'Unable to manage editorial sections.',
    500,
  );
};

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    await requireAdmin();
    const { id } = await params;
    return createSuccessResponse(
      toEditorialSectionResponse(
        await collectionService.getAdminEditorialSections(id),
      ),
    );
  } catch (error) {
    return handleError(error);
  }
};

export const PUT = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  try {
    await requireAdmin(cmsAdminRoles);
    const { id } = await params;
    const { sections } = editorialSectionsValidator.parse(await request.json());
    return createSuccessResponse(
      toEditorialSectionResponse(
        await collectionService.replaceEditorialSections(id, sections),
      ),
    );
  } catch (error) {
    return handleError(error);
  }
};
