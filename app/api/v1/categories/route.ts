import {
  INTERNAL_SERVER_ERROR_CODE,
  INTERNAL_SERVER_ERROR_MESSAGE,
} from '@/config/api';
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response';
import { CategoryService } from '@/services/category.service';

const categoryService = new CategoryService();

export const GET = async () => {
  try {
    return createSuccessResponse(await categoryService.getCategories());
  } catch {
    return createErrorResponse(
      INTERNAL_SERVER_ERROR_CODE,
      INTERNAL_SERVER_ERROR_MESSAGE,
      500,
    );
  }
};
