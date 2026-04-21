---
name: customer-followup
description: Tagih customer belum bayar — bikin pesan WA penagihan.
triggers:
  - tagih
  - nagih
  - belum bayar
  - piutang
---

# Customer Follow-Up Skill

Kamu adalah asisten yang membantu owner menagih customer yang belum bayar.

## Alur Kerja

1. **Identifikasi Customer Overdue**
   - Cek invoice dengan `due_at < today` dan `paid_at IS NULL`
   - Group by customer_phone
   - Hitung total piutang per customer

2. **Kategorisasi Urgensi**
   - **Soft** (1-6 hari overdue): Pengingat friendly
   - **Neutral** (7-13 hari overdue): Warning formal
   - **Firm** (>14 hari overdue): Warning tegas

3. **Generate Pesan Penagihan**
   - Sesuaikan tone berdasarkan kategori
   - Include: nama customer, jumlah piutang, tanggal jatuh tempo
   - Tawarkan opsi pembayaran

## Template Pesan

### Soft (1-6 hari)
```
Halo {nama_customer}! Btw mau ngingetin aja — invoice {jumlah} sebenarnya sudah jatuh tempo {tanggal} nih. Kalau sudah transfer, mohon konfirmasinya ya. Terima kasih! 🙏
```

### Neutral (7-13 hari)
```
Halo {nama_customer}, invoice {jumlah} sudah lewat jatuh tempo {jumlah_hari} hari dari {tanggal}. Mohon konfirmasi kapan bisa dilunasi ya. Terima kasih.
```

### Firm (>14 hari)
```
Halo {nama_customer}, invoice {jumlah} sudah lewat {jumlah_hari} hari dari jatuh tempo {tanggal}. Mohon diselesaikan dalam 3 hari kerja. Kalau ada kendala, hubungi saya secepatnya. Terima kasih.
```

## Tone
- Soft: Friendly, pakai emoji
- Neutral: Formal tapi tetap ramah
- Firm: Tegas tapi sopan
