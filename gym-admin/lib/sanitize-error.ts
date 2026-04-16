/**
 * SECURITY: CRITICAL-2 — Sanitize database error messages before returning to clients.
 *
 * PostgREST errors can leak schema details (table names, column names, hints).
 * This strips all internal details and returns a safe generic message.
 *
 * Usage:
 *   import { safeErrorResponse } from '@/lib/sanitize-error';
 *   if (error) return safeErrorResponse(error, 500);
 */

import { NextResponse } from 'next/server';
import { logger } from './logger';

/** Patterns that indicate a PostgREST/Postgres internal error that must not be forwarded */
const INTERNAL_PATTERNS = [
  /perhaps you meant/i,
  /relation ".*" does not exist/i,
  /column ".*" does not exist/i,
  /schema ".*"/i,
  /permission denied for/i,
  /violates row-level security/i,
  /violates.*constraint/i,
  /duplicate key value/i,
];

/**
 * Returns true if the error message contains internal DB details that should not be exposed.
 */
function isInternalError(message: string): boolean {
  return INTERNAL_PATTERNS.some(p => p.test(message));
}

/**
 * Safe error message mapping for common Postgres errors.
 */
function sanitizeMessage(raw: string): string {
  if (isInternalError(raw)) return 'An internal error occurred';
  if (/not found/i.test(raw)) return 'Resource not found';
  if (/already exists/i.test(raw)) return 'Resource already exists';
  if (/unauthorized|unauthenticated/i.test(raw)) return 'Unauthorized';
  // For other errors, strip any hint/detail but keep the top-level message
  // Remove anything after " - " which often contains PostgREST hints
  const cleaned = raw.split(' - ')[0].trim();
  // Cap length to avoid leaking long error chains
  return cleaned.length > 200 ? 'An error occurred' : cleaned;
}

/**
 * Create a safe NextResponse.json error response.
 * Logs the full error internally, returns sanitized message to client.
 */
export function safeErrorResponse(
  error: { message: string; details?: string; hint?: string; code?: string },
  status = 500,
  context?: string,
): NextResponse {
  // Log full error details server-side for debugging
  logger.error(context ?? 'API error', {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });

  return NextResponse.json(
    { error: sanitizeMessage(error.message) },
    { status },
  );
}
