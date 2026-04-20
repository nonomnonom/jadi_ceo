import { z } from 'zod';

export const TenantIdSchema = z.string().min(1).brand<'TenantId'>();
export type TenantId = z.infer<typeof TenantIdSchema>;

export const DEFAULT_TENANT_ID = 'default' as TenantId;

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
