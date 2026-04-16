import { NextResponse } from 'next/server';

/**
 * Standardised API error response.
 * Always returns { error: string } so the client has a single shape to handle.
 * Never include internal error details (stack traces, DB messages) in production.
 */
export function apiError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standardised API success response.
 */
export function apiOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}
