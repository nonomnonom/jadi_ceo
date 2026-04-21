---
name: invoice-reminder
description: Draft pesan reminder invoice jatuh tempo atau overdue — generate draft penagihan WhatsApp untuk owner kirim manual.
version: 1.0.0
tags:
  - invoice
  - reminder
  - collections
  - overdue
---

# Invoice Reminder — Draft Pesan Tagih

Aktifkan saat owner bilang "reminder invoice", "jatuh tempo", "invoice overdue", "belum bayar", "nagih piutang", "tagih customer", atau variasi lain tentang penagihan invoice.

## ⚠️ BUKAN AUTO-SEND
Sama seperti WA Blast — fitur ini HANYA generate draft pesan reminder. Owner yang decide kapan dan bagaimana pesan dikirim.

## Urutan
1. **`get-current-time`** — dapetin acuan waktu untuk hitung hari overdue.
2. Tanya: "Yang mau ditagih yang overdue aja atau yang即将 jatuh tempo juga?" (default: overdue dulu)
3. Kalau belum tahu invoice siapa: **`list-invoices`** dengan `status: 'overdue'` — tampilkan daftar (contactName + amountFormatted + hari overdue).
4. Kalau owner sudah sebut nama customer: **`list-contacts`** dengan `search: '<nama>'` — cari phone number.
5. **`list-invoices`** dengan `contactId: <id>` untuk dapetin detail invoice yang belum lunas.
6. Hitung hari overdue = today - due_date.
7. Generate 1-3 draft pesan dengan nada berbeda (soft/neutral/firm).
8. Owner pilih dan copy-paste ke WhatsApp.

## Pilih Nada Berdasarkan Lama Overdue

| Lama Overdue | Nada | Contoh |
|--------------|------|--------|
| <7 hari | **Soft** | "Mau ngingetin aja..." |
| 7-14 hari | **Netral** | "Mohon konfirmasi kapan bisa..." |
| >14 hari | **Firm** | "Mohon diselesaikan dalam 3 hari..." |

## Format Output

```
📋 Invoice Reminder — Draft

Customer: [Nama] · HP: [phone]
Invoice: [deskripsi] · [amountFormatted]
Jatuh tempo: [tanggal] ([X hari overdue])

Pilih nada:

1️⃣ SOFT:
"[draft pesan lembut]"

2️⃣ NEUTRAL:
"[draft pesan netral]"

3️⃣ FIRM:
"[draft pesan tegas]"

---
Silakan copy-paste dan kirim manual via WhatsApp.
MOHON JANGAN AUTO-KIRIM.
```

## Template Pesan

### Soft (<7 hari overdue)
> Halo [nama]! Btw mau ngingetin aja — invoice [deskripsi] sebesar [amountFormatted] sebenarnya sudah Jatuh tempo [tanggal] lho. Kalau sudah transfer, mohon konfirmasinya ya. Terima kasih! 🙏

### Neutral (7-14 hari)
> Halo [nama], invoice [deskripsi] sebesar [amountFormatted] sudah lewat Jatuh tempo [X hari] dari [tanggal]. Mohon konfirmasi kapan bisa dilunasi ya. Kalau ada kendala, langsung hubungi saya aja. Terima kasih.

### Firm (>14 hari)
> Halo [nama], invoice [deskripsi] [amountFormatted] sudah lewat [X hari] dari Jatuh tempo [tanggal]. Mohon diselesaikan dalam 3 hari kerja. Kalau ada kendala pembayaran, hubungi saya secepatnya supaya bisa cari solusi bareng. Terima kasih.

## Jangan
- Jangan auto-kirim reminder — owner harus approve dan kirim manual.
- Jangan pakai bahasa kasar atau ancaman.
- JanganDM ke semua customer sekaligus dalam satu pesan grup.
- Jangan terus-terusan nagih kalau owner belum approve.
