import {
  DATABASE_UNAVAILABLE_CODE,
  DATABASE_UNAVAILABLE_MESSAGE,
} from '@/config/api';
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response';
import { DatabaseRepository } from '@/repositories/database.repository';
import { DatabaseHealthService } from '@/services/database-health.service';

const databaseHealthService = new DatabaseHealthService(
  new DatabaseRepository(),
);

export const GET = async () => {
  try {
    const health = await databaseHealthService.getHealth();

    return createSuccessResponse(health);
  } catch {
    return createErrorResponse(
      DATABASE_UNAVAILABLE_CODE,
      DATABASE_UNAVAILABLE_MESSAGE,
      500,
    );
  }
};
