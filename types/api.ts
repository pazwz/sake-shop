export interface ApiError {
  code: string;
  detail: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  message: string;
  error: null;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  message: string;
  error: ApiError;
}
