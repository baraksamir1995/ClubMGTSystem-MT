/**
 * Structured JSON logger.
 *
 * Rules:
 * - Always emit JSON so log aggregators (Datadog, CloudWatch, etc.) can parse it.
 * - Never log full objects that may contain PII (emails, phones, full profiles).
 * - Log resource IDs, not resource contents.
 *
 * Usage:
 *   logger.info('Payment refund initiated', { paymentId, gymId, actorId });
 *   logger.error('Paymob API failure', { status: 502, paymentId });
 */

type LogMeta = Record<string, unknown>;

function emit(level: 'info' | 'warn' | 'error' | 'audit', msg: string, meta?: LogMeta) {
  const entry = JSON.stringify({ level, msg, ...meta, ts: Date.now() });
  if (level === 'error') {
    console.error(entry);
  } else if (level === 'warn' || level === 'audit') {
    console.warn(entry);
  } else {
    console.log(entry);
  }
}

export const logger = {
  info:  (msg: string, meta?: LogMeta) => emit('info',  msg, meta),
  warn:  (msg: string, meta?: LogMeta) => emit('warn',  msg, meta),
  error: (msg: string, meta?: LogMeta) => emit('error', msg, meta),
  /** Use for security-sensitive operations: refunds, deletions, role changes. */
  audit: (msg: string, meta?: LogMeta) => emit('audit', msg, meta),
};
