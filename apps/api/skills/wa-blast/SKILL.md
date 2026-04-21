---
name: wa-blast
description: Draft pesan broadcast ke semua customer WhatsApp — generate draft, owner review, baru kirim manual (BUKAN auto-send).
version: 1.0.0
tags:
  - whatsapp
  - broadcast
  - marketing
---

# WA Blast — Draft Pesan Massal

Aktifkan saat owner bilang "blast WA", "kirim ke semua customer", "broadcast WhatsApp", "kirim promo ke semua", "mass message", atau variasi lain tentang kirim pesan ke banyak customer sekaligus.

## ⚠️ PENTING: BUKAN AUTO-SEND
Fitur ini HANYA generate draft. Owner yang decide:
- Apakah akan kirim sendiri via WhatsApp
- Pakai tools tambahan (seperti Broadcast tool di WhatsApp Business)
- Atau tetap simpan sebagai template

**Kita TIDAK auto-kirim pesan. Semua pesan harus owner approve dan kirim manual.**

## Urutan
1. **`get-current-time`** — acuan waktu.
2. Tanya owner: "Mau kirim ke semua customer atau filter tertentu?" (semua customer, atau berdasarkan上次 conversation, dll)
3. Kalau filter: **`list-contacts`** dengan `type: 'customer'`.
4. Tanya isi pesan yang mau dikirim — bisa:
   - Owner sudah punya pesan siap
   - Atau minta bantuan bikin pesan (promo, announcement, dll)
5. Kalau minta bantuan bikin pesan, tanyakan:
   - Tujuan pesan (promo, announcement, reminder, dll)
   - Produk/offer yang di-promote (kalau ada)
   - Tone nada (formal, casual,促销)
6. Generate 1-2 draft pesan.
7. Tampilkan daftar recipient (jumlah customer) + draft pesan.
8. Owner review dan approve → baru kasih catatan "Silakan copy-paste ke WhatsApp Business atau broadcast tool."

## Format Output

```
📱 WA Blast — Draft

Recipient: [N] customer
Tone: [tone]

--- DRAFT ---
[isi pesan]

--- AKHIR DRAFT ---

Silakan copy-paste ke WhatsApp Business atau broadcast tool.
MOHON JANGAN AUTO-KIRIM dari sistem ini.
```

## Template Pesan Promo
> "Halo [nama]! 👋
>
> Ada promo spesial untuk kamu:
>
> [produk/promo]
>
> Berlaku sampai [tanggal]
>
> Order via WhatsApp ini ya!"

## Jangan
- Jangan auto-kirim pesan tanpa approval owner.
- Jangan spam customer dengan frekuensi tinggi.
- Jangan kirim konten yang bisa di-flag WhatsApp (terlalu banyak link, kata "FREE", dll).
- Jangan tag semua customer dalam satu grup WA — kirim personal/individual.
- Jangan simpan nomor customer di grup broadcast besar (bubble).
