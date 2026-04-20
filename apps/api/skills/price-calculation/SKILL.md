---
name: price-calculation
description: Hitung harga jual dari HPP + margin target, atau hitung margin dari harga yang sudah ada. Kasih 2-3 rekomendasi harga alternatif dengan pedoman industri Indonesia.
version: 1.0.0
tags:
  - pricing
  - margin
  - calculation
---

# Price Calculation

Aktifkan saat owner bilang "hitungin harga jual", "HPP-nya X, harusnya jual berapa", "margin berapa sih kalau jual Y", "mau untung N%", atau minta analisa pricing produk.

## Formula yang wajib kamu pakai
- **HPP** (Harga Pokok Penjualan) = total biaya produksi per unit
- **Margin%** = (harga_jual - HPP) / harga_jual × 100
- **Markup%** = (harga_jual - HPP) / HPP × 100  *(beda dari margin!)*
- **Harga jual dari margin target** = HPP ÷ (1 - margin_target/100)
- **Profit per unit** = harga_jual - HPP

Penting: margin dan markup SERING tertukar. 50% markup ≠ 50% margin. 50% markup artinya harga jual 1.5× HPP (margin 33%). Selalu klarifikasi kalau owner ambigu.

## Urutan
1. Klarifikasi HPP (rupiah per unit). Kalau owner belum sebut, tanya.
2. Klarifikasi target: margin%, markup%, atau harga jual yang sudah ada?
3. Hitung angka lengkap (pakai kalkulasi manual, jangan tool) dan sajikan.
4. Kasih **3 rekomendasi harga** dengan margin berbeda (contoh: 20%, 30%, 40%) biar owner bisa pilih.
5. Kalau produk sudah ada di katalog: panggil **`list-products`** dengan `search: '<nama>'` untuk cek harga current. Kalau sudah ada, tawarkan update (jangan auto-update — minta konfirmasi).

## Format output
```
HPP: Rp X per unit

Kalau mau margin 20%: harga jual Rp A · profit Rp (A-X)
Kalau mau margin 30%: harga jual Rp B · profit Rp (B-X)
Kalau mau margin 40%: harga jual Rp C · profit Rp (C-X)

Pedoman industri (Indonesia UMKM):
- Retail eceran: margin 30-50%
- Grosir: margin 10-20%
- Jasa/digital: margin 50-80%
- FnB restoran: margin 60-70%

Mau pakai yang mana?
```

Format angka pakai gaya Indonesia: `Rp 1.500.000` (titik sebagai pemisah ribuan).

## Jangan
- Jangan auto-update harga di katalog tanpa konfirmasi eksplisit.
- Jangan tebak HPP — selalu tanya owner.
- Jangan campur istilah margin/markup tanpa klarifikasi.
- Jangan kasih saran diskon/promosi di sini — itu beda topik.
