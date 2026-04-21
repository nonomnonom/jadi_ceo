---
name: expense-claim
description: Proses expense claim dari karyawan — catat pengajuan, minta approval owner, catat sebagai expense kalau approved.
version: 1.0.0
tags:
  - expense
  - claim
  - reimbursement
  - approval
---

# Expense Claim — Klaim Biaya Karyawan

Aktifkan saat owner bilang "expense claim", "claim biaya", "reimburse", "biaya karyawan", "nota karyawan", "pengajuan expense", atau variasi lain tentang klaim biaya oleh karyawan.

## Alur
1. **Pengajuan** — Karyawan/submitter ajukan expense
2. **Review** — Owner review dan approve/reject
3. **Pencatatan** — Kalau approved, catat sebagai expense via `log-transaction`

## Urutan

### Kalau Owner Ajuin (untuk karyawan):
1. Tanya: "Expense atas nama siapa?" → catat nama karyawan
2. Tanya: "Untuk apa?" → deskripsi expense
3. Tanya: "Jumlahnya berapa?" → amount_idr
4. Tanya: "Kategori apa?" → kalau owner belum punya, tawarkan kategori umum (transport, makan, supplies, lain-lain)
5. Tanya: "Ada nota/bukti?" → catat kalau ada (foto/filepath)
6. Kalau amount signifikan ( > Rp 500.000 ), tanya: "Mau langsung catat atau minta approval dulu?"
7. Kalau minta approval: simpan sebagai pending claim dan minta owner approve
8. Kalau langsung catat: panggil **`log-transaction`** dengan `kind: 'expense'`

### Kalau Owner Review (approve/reject):
1. Tampilkan daftar pending expense claim
2. Owner decide: approve atau reject
3. Kalau approve: panggil **`log-transaction`** untuk catat expense
4. Kalau reject: kasih tahu karyawan + alasan

## Format Pengajuan

```
💰 Expense Claim

Pengaju: [Nama Karyawan]
Untuk: [Deskripsi]
Jumlah: Rp [amount]
Kategori: [kategori]
Nota: [ada/tidak ada]
Tanggal: [tanggal]

Status: [Pending/Approved/Rejected]
```

## Kategori Expense Umum
- Transport (bensin, ojol, parkir)
- Makan (makan siang client, snack meeting)
- Supplies (ATK, print, folio)
- Communication (telepon, internet)
- Lain-lain

## Jangan
- Jangan catat expense tanpa bukti/nota kalau owner minta.
- Jangan approve sendiri kalau kamu Agent (owner harus approve).
- Jangan campur expense karyawan dengan keuangan pribadi owner.
- Jangan approve expense yang tidak wajar tanpa konfirmasi.
