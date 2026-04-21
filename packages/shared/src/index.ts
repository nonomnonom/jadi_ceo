import { z } from 'zod';

export const TenantIdSchema = z.string().min(1).brand<'TenantId'>();
export type TenantId = z.infer<typeof TenantIdSchema>;

/**
 * Single source of truth for the default tenant id in single-tenant mode.
 * Phase 3 replaces this with an AsyncLocalStorage-backed accessor, so consumers
 * importing from here will not need code changes when multi-tenant lands.
 */
export const DEFAULT_TENANT_ID: string = process.env.DEFAULT_TENANT_ID ?? 'default';

export type Role = 'owner' | 'customer';
export type Channel = 'telegram' | 'whatsapp';

/**
 * Format a Rupiah amount using Indonesian grouping ("Rp 1.500.000"). Negative values get a leading minus.
 */
export function formatIDR(amountIdr: number): string {
  const abs = Math.abs(Math.trunc(amountIdr));
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${amountIdr < 0 ? '-' : ''}Rp ${grouped}`;
}
