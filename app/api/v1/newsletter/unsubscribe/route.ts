import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { assertSameOriginMutation } from '@/lib/request-security';
import { NewsletterService } from '@/services/newsletter.service';
import { newsletterUnsubscribeValidator } from '@/validators/newsletter.validator';

const protectResponse = (response: Response) => {
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
};

export const GET = async (request: Request) => {
  try {
    const token = new URL(request.url).searchParams.get('token') ?? '';
    const state = await new NewsletterService().getUnsubscribeState(token);
    return protectResponse(createSuccessResponse({ state }));
  } catch {
    return protectResponse(
      createErrorResponse(
        'NEWSLETTER_UNSUBSCRIBE_UNAVAILABLE',
        '現在お手続きいただけません。時間をおいてお試しください。',
        503,
      ),
    );
  }
};

export const POST = async (request: Request) => {
  try {
    assertSameOriginMutation(request);
    const input = newsletterUnsubscribeValidator.parse(await request.json());
    return protectResponse(
      createSuccessResponse(
        await new NewsletterService().unsubscribe(input.token),
      ),
    );
  } catch (error) {
    if (error instanceof ZodError)
      return createAppErrorResponse(new ValidationError());
    if (error instanceof AppError) return createAppErrorResponse(error);
    return createErrorResponse(
      'NEWSLETTER_UNSUBSCRIBE_FAILED',
      '配信停止に失敗しました。',
      500,
    );
  }
};
