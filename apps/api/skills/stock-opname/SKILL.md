---
name: stock-opname
description: Proses stock opname — bandingkan stok sistem vs stok fisik, catat variance, dan suggest penyesuaian.
version: 1.0.0
tags:
  - inventory
  - stock
  - opname
---

# Stock Opname

Aktifkan saat owner bilang "stock opname", "cek stok fisik", "opname", "aduit stok", "bandingkan stok", atau variasi lain tentang pencocokan stok.

## Urutan
1. **`get-current-time`** — dapetin acuan waktu Jakarta.
2. **`list-products`** dengan `limit: 100` — ambil semua produk untuk dibandingkan.
3. Tanya owner: "Mau opname semua produk atau produk tertentu?" Kalau tertentu, minta nama/sku produk.
4. Owner kasih data stok fisik — catat dalam format tabel (Produk | Stok Sistem | Stok Fisik | Variance).
5. Hitung variance = Stok Fisik - Stok Sistem.
6. Kalau variance ≠ 0, tawarkan **`adjust-stock`** dengan delta = variance dan reason = "selisih opname [tanggal]".

## Format Output

```
📅 Stock Opname — [tanggal dari get-current-time]

| Produk | Sistem | Fisik | Variance |
|--------|--------|-------|----------|
| Item A | 50 | 48 | -2 |
| Item B | 30 | 30 | 0 |
| Item C | 20 | 25 | +5 |

✅ Variance 0: [N] produk — STOK SESUAI
⚠️ Ada variance: [N] produk perlu disesuaikan

Mau saya adjust stock yang variance? (Ya/Tidak)
```

## Variance Categories
- **-N (minus)**: Stok fisik LEBIH SEDIKIT dari sistem → ada kemungkinan barang hilang/rusak/keliru catat
- **+N (plus)**: Stok fisik LEBIH BANYAK dari sistem → ada kemungkinan terima barang tidak catat/salah catat

## Jangan
- Jangan auto-adjust tanpa konfirmasi owner.
- Jangan assume minus = hilang dicuri — selalu tanya owner dulu.
- Jangan opname kalau owner belum punya data stok fisik.
