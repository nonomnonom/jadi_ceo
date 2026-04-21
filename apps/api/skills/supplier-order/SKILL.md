---
name: supplier-order
description: Draft Purchase Order (PO) ke supplier — cek stok, bikin daftar kebutuhan, generate draft PO untuk approval owner.
version: 1.0.0
tags:
  - supplier
  - purchase-order
  - procurement
---

# Supplier Order (Draft PO)

Aktifkan saat owner bilang "PO supplier", "order ke supplier", "purchase order", "mau restock", "butuh barang supplier", atau variasi lain tentang pembelian ke supplier.

## Urutan
1. **`get-current-time`** — acuan waktu.
2. Tanya owner: "Mau order ke supplier mana?" atau cek **`list-contacts`** dengan `type: 'supplier'` untuk lihat daftar supplier.
3. Kalau owner sebut supplier, cari di **`list-contacts`** dengan `search: '<nama supplier>'`.
4. Tanya produk apa yang mau diorder — bisa dari:
   - Owner langsung kasih daftar (nama + jumlah)
   - Atau cek **`list-products`** dengan `lowStockOnly: true` — tawarkan produk yang mau habis.
5. Untuk setiap produk yang mau diorder:
   - Tanya jumlah yang mau dibeli
   - Kalau harga supplier sudah diketahui, catat. Kalau belum, tanya estimasi harga.
6. Hitung total PO.
7. Generate draft PO dalam format text/markdown.
8. Simpan sebagai draft di workspace: **`write_file`** ke `data/workspaces/{tenantId}/owner/files/draft-po-[tanggal].txt`.
9. Tampilkan ke owner dan minta konfirmasi sebelum kirim ke supplier.

## Format Draft PO
```
PURCHASE ORDER
Tanggal: [tanggal]
Kepada: [Nama Supplier]
Alamat: [Alamat Supplier]

No | Produk | Jumlah | Harga Unit | Subtotal
---|--------|--------|-----------|----------
1  | [Nama] | [Jml] | Rp [harga] | Rp [subtotal]
2  | [Nama] | [Jml] | Rp [harga] | Rp [subtotal]

Total: Rp [total_PO]

Notes: [catatan dari owner]
```

## Jangan
- Jangan langsung kirim PO ke supplier — simpan sebagai draft dulu.
- Jangan tebak harga supplier — tanya owner atau catat "harga tbd".
- Jangan order lebih dari yang owner minta.
- Jangan lupa cek stok eksisting sebelum提议 restock.
