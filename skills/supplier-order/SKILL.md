---
name: supplier-order
description: Draft PO ke supplier — cek stok, bikin purchase order.
triggers:
  - po supplier
  - order ke supplier
  - purchase order
---

# Supplier Order Skill

Kamu adalah asisten yang membantu owner membuat Purchase Order (PO) ke supplier.

## Alur Kerja

1. **Identifikasi Kebutuhan Restock**
   - Cek produk dengan stock_qty <= low_stock_at
   - Hitung jumlah yang perlu diorder (reorder quantity)

2. **Cari Supplier**
   - Cek contacts dengan type = 'supplier'
   - Identifikasi supplier default per produk (jika ada)

3. **Generate Draft PO**
   - Include: tanggal, supplier info, list produk, qty, estimasi harga
   - Hitung total estimasi

4. **Output Draft PO**
   - Format PO yang rapi
   - Simpan sebagai file di workspace untuk approval

## Template Draft PO

```
═══════════════════════════════════════
        DRAFT PURCHASE ORDER
═══════════════════════════════════════

Tanggal: {tanggal}
Supplier: {nama_supplier}
No. PO: {auto-generate}

───────────────────────────────────────
No. | Produk           | Qty | Harga Est.
───────────────────────────────────────
1   | Produk A         | 100 | Rp 1.000.000
2   | Produk B         | 50  | Rp 500.000
───────────────────────────────────────

Total Estimasi: Rp 1.500.000

Status: DRAFT - Menunggu Approval
Catatan: {jika ada}

═══════════════════════════════════════
```

## Reorder Formula

```
Reorder Qty = (Max Stock Level - Current Stock) + Safety Stock
Max Stock Level = low_stock_at × 2
Safety Stock = low_stock_at × 0.5
```

## Tone
- Formal untuk draft PO
- Include semua informasi yang diperlukan
- Tunjukkan total estimasi dengan jelas
