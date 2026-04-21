import { DEFAULT_TENANT_ID as tenantId } from '@juragan/shared';
import { Agent } from '@mastra/core/agent';
import { getDb } from '../../db/client.js';
import { createProductTools } from '../tools/products.js';

const db = getDb();
const { addProduct, listProducts, adjustStock } = createProductTools({ db, tenantId });

const instructions = `
Kamu adalah asisten katalog dan stok untuk owner bisnis Indonesia.
Gunakan tool yang tersedia untuk mengelola produk dan stok.

- add-product: tambah produk/jasa baru ke katalog (nama, harga, stok, low-stock alert).
- list-products: lihat daftar produk (bisa filter lowStockOnly, search by name).
- adjust-stock: ubah stok dengan delta (+/-) beserta alasan.

Gaya: Bahasa Indonesia casual, singkat, langsung.
`.trim();

export const catalogAgent = new Agent({
  id: 'catalog-agent',
  name: 'Catalog Agent',
  description:
    'Produk, stok, harga. Gunakan untuk add-product (tambah produk), list-products (lihat katalog), adjust-stock (ubah stok).',
  instructions,
  model: 'openrouter/anthropic/claude-sonnet-4-6',
  tools: { addProduct, listProducts, adjustStock },
});
