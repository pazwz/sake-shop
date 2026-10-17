import { createAppErrorResponse } from '@/lib/api-response';
import { AppError } from '@/lib/errors';
import { assertCronAuthorization } from '@/services/smaregi/smaregi-sync-access.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = async (request: Request) => {
  try {
    assertCronAuthorization(request.headers.get('authorization'));
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AppError) return createAppErrorResponse(error);
    throw error;
  }
};
