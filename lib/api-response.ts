import { NextResponse } from 'next/server';
import { API_SUCCESS_RESPONSE } from '@/config/api';

export const createSuccessResponse = () => NextResponse.json(API_SUCCESS_RESPONSE);
