import { NextResponse } from 'next/server';
import { API_EMPTY_MESSAGE } from '@/config/api';
import type { ApiErrorResponse, ApiSuccessResponse } from '@/types/api';

export const createSuccessResponse = <T>(data: T, status = 200) =>
  NextResponse.json<ApiSuccessResponse<T>>(
    {
      success: true,
      data,
      message: API_EMPTY_MESSAGE,
      error: null,
    },
    { status },
  );

export const createErrorResponse = (
  code: string,
  detail: string,
  status: number,
) =>
  NextResponse.json<ApiErrorResponse>(
    {
      success: false,
      data: null,
      message: API_EMPTY_MESSAGE,
      error: { code, detail },
    },
    { status },
  );
