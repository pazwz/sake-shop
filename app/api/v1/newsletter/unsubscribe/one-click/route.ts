import { ZodError } from 'zod';
import {
  createAppErrorResponse,
  createErrorResponse,
  createSuccessResponse,
} from '@/lib/api-response';
import { AppError, ValidationError } from '@/lib/errors';
import { NewsletterService } from '@/services/newsletter.service';
import { newsletterUnsubscribeValidator } from '@/validators/newsletter.validator';

// RFC 8058 mailbox-server requests authenticate with the signed bearer, not a Customer session.
export const POST = async (request: Request) => {
  let response: Response;
  try {
    const contentType = request.headers
      .get('content-type')
      ?.split(';')[0]
      .trim()
      .toLowerCase();
    if (
      contentType !== 'application/x-www-form-urlencoded' &&
      contentType !== 'multipart/form-data'
    )
      throw new ValidationError();
    const form = await request.formData();
    if (form.get('List-Unsubscribe') !== 'One-Click')
      throw new ValidationError();
    const { token } = newsletterUnsubscribeValidator.parse({
      token: new URL(request.url).searchParams.get('token'),
    });
    response = createSuccessResponse(
      await new NewsletterService().unsubscribe(token),
    );
  } catch (error) {
    if (error instanceof ZodError)
      response = createAppErrorResponse(new ValidationError());
    else if (error instanceof AppError)
      response = createAppErrorResponse(error);
    else
      response = createErrorResponse(
        'NEWSLETTER_UNSUBSCRIBE_FAILED',
        '配信停止に失敗しました。',
        500,
      );
  }
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
};
