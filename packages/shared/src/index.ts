import { z } from 'zod';

export const TenantIdSchema = z.string().min(1).brand<'TenantId'>();
export type TenantId = z.infer<typeof TenantIdSchema>;

export type Role = 'owner' | 'customer';
export type Channel = 'telegram' | 'whatsapp';
