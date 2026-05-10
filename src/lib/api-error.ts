/**
 * Centralized error handling for API routes
 * Logs full details server-side, returns generic message to client in production
 */

import { NextResponse } from 'next/server';

/**
 * Error codes that may be safely returned to the client
 * All others map to "internal_error"
 */
const PUBLIC_ERROR_CODES = {
  VALIDATION_ERROR: 'validation_error',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate_limited',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  INTERNAL_ERROR: 'internal_error',
} as const;

export type PublicErrorCode = (typeof PUBLIC_ERROR_CODES)[keyof typeof PUBLIC_ERROR_CODES];

/**
 * Production-safe error response
 */
export interface ApiErrorResponse {
  ok: false;
  error: {
    code: PublicErrorCode;
    message: string;
  };
}

/**
 * Safe message map - only these messages are sent to clients
 */
const SAFE_MESSAGES: Record<PublicErrorCode, string> = {
  validation_error: 'Invalid request data.',
  unauthorized: 'Authentication required.',
  forbidden: 'Access denied.',
  not_found: 'Resource not found.',
  conflict: 'Resource already exists.',
  rate_limited: 'Too many requests. Please try again later.',
  service_unavailable: 'Service temporarily unavailable. Please try again later.',
  internal_error: 'An error occurred. Please try again later.',
};

/**
 * Classify an error to determine the appropriate public code and HTTP status
 */
function classifyError(error: unknown): {
  code: PublicErrorCode;
  status: number;
  safeMessage: string;
} {
  // Check for error code patterns
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;

    // Firebase auth errors
    if (typeof err.code === 'string') {
      const code = err.code as string;
      if (code.startsWith('auth/')) {
        if (
          code === 'auth/invalid-email' ||
          code === 'auth/invalid-password' ||
          code === 'auth/weak-password'
        ) {
          return {
            code: PUBLIC_ERROR_CODES.VALIDATION_ERROR,
            status: 400,
            safeMessage: SAFE_MESSAGES.validation_error,
          };
        }
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
          return {
            code: PUBLIC_ERROR_CODES.UNAUTHORIZED,
            status: 401,
            safeMessage: SAFE_MESSAGES.unauthorized,
          };
        }
        if (code === 'auth/email-already-exists') {
          return {
            code: PUBLIC_ERROR_CODES.CONFLICT,
            status: 409,
            safeMessage: SAFE_MESSAGES.conflict,
          };
        }
      }
    }

    // Check for HTTP status in custom error objects
    if (typeof err.statusCode === 'number') {
      const status = err.statusCode as number;
      if (status === 401) {
        return {
          code: PUBLIC_ERROR_CODES.UNAUTHORIZED,
          status: 401,
          safeMessage: SAFE_MESSAGES.unauthorized,
        };
      }
      if (status === 403) {
        return {
          code: PUBLIC_ERROR_CODES.FORBIDDEN,
          status: 403,
          safeMessage: SAFE_MESSAGES.forbidden,
        };
      }
      if (status === 404) {
        return {
          code: PUBLIC_ERROR_CODES.NOT_FOUND,
          status: 404,
          safeMessage: SAFE_MESSAGES.not_found,
        };
      }
      if (status === 409) {
        return {
          code: PUBLIC_ERROR_CODES.CONFLICT,
          status: 409,
          safeMessage: SAFE_MESSAGES.conflict,
        };
      }
      if (status === 429) {
        return {
          code: PUBLIC_ERROR_CODES.RATE_LIMITED,
          status: 429,
          safeMessage: SAFE_MESSAGES.rate_limited,
        };
      }
      if (status === 503) {
        return {
          code: PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE,
          status: 503,
          safeMessage: SAFE_MESSAGES.service_unavailable,
        };
      }
    }
  }

  // Default to internal error
  return {
    code: PUBLIC_ERROR_CODES.INTERNAL_ERROR,
    status: 500,
    safeMessage: SAFE_MESSAGES.internal_error,
  };
}

/**
 * Log error details server-side (only logged, never sent to client)
 */
function logError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>
): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  console.error(`[${context}] Error occurred:`, {
    message: errorMessage,
    stack: errorStack,
    metadata,
  });
}

/**
 * Handle an API error and return a safe response
 * This is the main function to use in route handlers
 */
export function handleApiError(
  error: unknown,
  context: string,
  metadata?: Record<string, unknown>
): NextResponse<ApiErrorResponse> {
  // Log full details server-side
  logError(context, error, metadata);

  // Classify and return safe response
  const { code, status, safeMessage } = classifyError(error);

  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message: safeMessage,
      },
    },
    { status }
  );
}

/**
 * Create a success response (for consistency)
 */
export function createSuccessResponse<T extends Record<string, unknown>>(
  data: T,
  status = 200
): NextResponse {
  return NextResponse.json({ ok: true, ...data }, { status });
}

/**
 * Validation error response (safe to include some context about what's invalid)
 */
export function createValidationErrorResponse(
  issues: Array<{ field: string; message: string }>
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: PUBLIC_ERROR_CODES.VALIDATION_ERROR,
        message: SAFE_MESSAGES.validation_error,
      },
    },
    { status: 400 }
  );
}
