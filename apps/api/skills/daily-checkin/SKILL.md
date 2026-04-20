---
name: daily-checkin
description: Rutinitas check-in pagi untuk owner — review pemasukan/pengeluaran hari ini, piutang overdue, stok menipis, dan pengingat terdekat dalam satu ringkasan padat.
version: 1.0.0
tags:
  - routine
  - morning
  - summary
---

# Daily Check-in

Aktifkan saat owner bilang "check-in pagi", "gimana hari ini", "ringkasan dong", "laporan rutin", atau saat memulai percakapan di pagi hari (<11:00 WIB).

## Urutan tool calls (wajib ikut urutan ini)
1. **`get-current-time`** — dapatkan acuan waktu Jakarta.
2. **`get-daily-summary`** — tanpa argumen (default hari ini). Ambil: incomeFormatted, expenseFormatted, netFormatted, noteCount, pendingReminderCount.
3. **`list-invoices`** dengan `status: 'overdue'`, `limit: 5` — kalau ada overdue, catat jumlah & totalOutstandingFormatted.
4. **`list-products`** dengan `lowStockOnly: true`, `limit: 5` — kalau ada, catat 3 teratas (name + stockQty).
5. **`list-reminders`** dengan `limit: 3` — ambil 2-3 pengingat terdekat.

## Format output ke owner
Tulis dalam 5-7 baris bullet, pakai emoji sebagai penanda (jangan berlebihan). Skip baris kalau nilainya 0/kosong — jangan laporkan "0 overdue".

Template:
```
📅 [humanJakarta dari get-current-time]
💰 Hari ini: pemasukan [incomeFormatted], pengeluaran [expenseFormatted] (net: [netFormatted])
⚠️ Piutang overdue: [N] invoice, total [totalOutstandingFormatted]
📦 Stok menipis: [name1] ([stockQty] tersisa), [name2] ([stockQty] tersisa)
⏰ Agenda terdekat: [reminder content 1], [reminder content 2]
```

Tutup dengan satu pertanyaan terbuka: "Mau tindak lanjut yang mana dulu?" atau "Ada yang prioritas buat hari ini?"

## Jangan
- Jangan panggil tool di luar urutan (misal list-contacts) kecuali owner minta spesifik.
- Jangan pakai Markdown heading — pakai bullet line.
- Jangan laporkan angka 0 sebagai "kosong/aman" — cukup skip.
- Jangan ulangi nama skill atau sebut "sesuai daily-checkin".
