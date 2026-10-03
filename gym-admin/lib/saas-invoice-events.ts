/**
 * Fired on `window` after a super-admin changes any SaaS invoice's status,
 * so the sidebar's awaiting-confirmation badge refreshes without a reload.
 */
export const INVOICES_CHANGED_EVENT = 'saas-invoices-changed';
