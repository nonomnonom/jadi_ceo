---
name: customer-followup
description: Draft pesan WhatsApp sopan-tapi-tegas untuk menagih piutang overdue. Selalu kasih 2-3 draft dengan nada berbeda, jangan auto-kirim.
version: 1.0.0
tags:
  - collections
  - customer
  - whatsapp
---

# Customer Followup

Aktifkan saat owner bilang "tagih customer X", "bikinin chat WA buat nagih", "customer Y belum bayar gimana enaknya", atau variasi lain tentang menagih piutang.

## Urutan
1. Kalau owner belum sebut nama customer: **`list-invoices`** dengan `status: 'overdue'` — tampilkan list singkat (contactName + amountFormatted + hari overdue) dan tanya "Mau tagih yang mana dulu?"
2. Kalau owner sudah sebut nama: **`list-contacts`** dengan `search: '<nama>'` — pastikan dapat phone number. Kalau tidak ada phone, bilang ke owner dan tanya nomornya.
3. **`list-invoices`** dengan `contactId: <id>` — konfirmasi invoice mana yang mau ditagih + amount + deskripsi + dueAt.
4. **`get-current-time`** — untuk hitung berapa hari overdue.
5. Tawarkan **2-3 draft** WhatsApp (jangan langsung kirim — kita belum punya integrasi WA di versi ini).

## Pilih nada berdasarkan lama overdue
- **Lembut** (<7 hari overdue) — anggap customer lupa, kasih reminder ramah.
- **Netral** (7-14 hari) — sudah lewat jelas, tanyakan kapan bisa selesai.
- **Tegas** (>14 hari) — kasih deadline 3 hari, tawarkan diskusi kalau ada kendala.

## Template (sesuaikan bracket [...])

### Lembut
> Halo [nama], mau ngingetin aja untuk invoice [deskripsi] sebesar [amountFormatted] yang jatuh tempo [tanggal]. Kalau sudah transfer, mohon konfirmasi yaa 🙏 Terima kasih!

### Netral
> Halo [nama], invoice [deskripsi] sebesar [amountFormatted] sudah lewat jatuh tempo [X hari]. Mohon konfirmasi kapan bisa diselesaikan ya? Kalau ada kendala, kasih tau aja, kita bisa diskusi.

### Tegas
> Halo [nama], invoice [deskripsi] [amountFormatted] sudah lewat [X hari] dari jatuh tempo. Mohon diselesaikan dalam 3 hari kerja. Kalau ada kendala pembayaran, langsung hubungi saya ya supaya kita cari solusi bareng.

## Output format ke owner
```
Customer: [nama] · HP: [phone]
Invoice: [deskripsi] · [amountFormatted] · overdue [X hari]

Pilih nada:
1. Lembut: "[draft lembut]"
2. Netral: "[draft netral]"
3. Tegas: "[draft tegas]"

Mau pakai yang mana? Copy-paste ke WA aja.
```

## Jangan
- Jangan kirim draft apapun secara otomatis. Selalu owner yang copy-paste.
- Jangan pakai ancaman legal kecuali owner eksplisit minta.
- Jangan bocor nominal di group chat — asumsikan DM/personal chat.
- Jangan pakai bahasa kasar atau mengintimidasi bahkan di nada "tegas".
