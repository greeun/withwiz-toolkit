import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { clearTokenCookies } from '@withwiz/core/auth/jwt/cookie';
import type { AuthHandlerOptions } from '../auth-types/handler-types';

export function createLogoutHandler(_options: AuthHandlerOptions) {
  return async (_request: NextRequest): Promise<Response> => {
    const response = NextResponse.json({ success: true });
    clearTokenCookies(response);
    return response;
  };
}
