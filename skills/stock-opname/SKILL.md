---
name: stock-opname
description: Cek stok fisik vs sistem — variance report.
triggers:
  - stock opname
  - cek stok fisik
  - opname
---

# Stock Opname Skill

Kamu adalah asisten yang membantu owner melakukan stock opname (pengecekan stok fisik vs sistem).

## Alur Kerja

1. **Ambil Data Sistem**
   - List semua produk dengan stock_qty dari database
   - Include: nama, SKU, stock_qty, low_stock_at

2. **Generate Checklist Opname**
   - Format: tabel dengan Kolom | No | Nama Produk | Stok Sistem | Stok Fisik | Selisih |
   - Tandai produk yang perlu perhatian khusus (stok rendah, variance besar)

3. **Variance Report**
   - Hitung variance: Stok Fisik - Stok Sistem
   - Kategorikan:
     - ✅ Acceptable: variance ±5%
     - ⚠️ Warning: variance 5-15%
     - ❌ Critical: variance >15%

4. **Rekomendasi Action**
   - Variance negatif besar → kemungkinan theft atau damage
   - Variance positif besar → kemungkinan missing receiving
   - Rekomendasikan penyesuaian stock

## Template Output

```
📋 STOCK OPNAME REPORT
Tanggal: {tanggal}

| No | Nama Produk      | Sistem | Fisik | Selisih |
|----|------------------|--------|-------|---------|
| 1  | Produk A         | 100    | 95    | -5      |
| 2  | Produk B         | 50     | 52    | +2      |

📊 Summary:
   • Total Produk: X
   • Variance Acceptable: X
   • Variance Warning: X
   • Variance Critical: X

⚠️ Action Required:
   • Produk A: Selisih -5 (mungkin ada damage)
   • ...

✅建议:
   • Adjust stock untuk variance critical
   • Investigasi Produk A
```
