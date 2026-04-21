# Juragan v1.0 - Use Cases

## Document Status

- Status: Planning
- Purpose: mendokumentasikan skenario penggunaan utama, alur sistem, dan edge case
- Audience: product, engineering, QA
- Scope: use case owner, customer, system, dan failure scenarios

## How to Read This Document

Setiap use case berisi:

- actor
- trigger
- precondition
- main flow
- alternate flow jika ada
- expected outcome

## Owner Use Cases

### UC-001: First-Time Setup

- Actor: Owner
- Trigger: pertama kali menjalankan Juragan
- Precondition: aplikasi sudah terdeploy atau `docker-compose up` berhasil

Main flow:

1. Owner membuka dashboard.
2. Owner mengisi OpenRouter API key dan Telegram Bot Token.
3. Owner membuka menu WhatsApp dan melihat QR pairing.
4. Owner scan QR dari WhatsApp.
5. Sistem menyimpan auth state dan status channel berubah menjadi connected.
6. Owner menerima greeting atau status siap pakai.

Expected outcome:

- Telegram owner channel aktif
- WhatsApp channel aktif
- setting tersimpan tanpa edit manual `.env` untuk penggunaan normal

### UC-002: Manage Product Catalog

- Actor: Owner via Telegram
- Trigger: owner ingin tambah atau ubah produk
- Precondition: Owner Agent aktif

Main flow:

1. Owner mengirim perintah atau pesan natural language.
2. Owner Agent mem-parsing detail produk.
3. Agent meminta konfirmasi jika data penting belum jelas.
4. Owner menyetujui.
5. Sistem menyimpan produk atau perubahan stok.

Alternate flow:

- owner upload CSV untuk import massal
- owner minta edit produk tertentu
- owner minta nonaktifkan produk yang habis

Expected outcome:

- data katalog rapi dan bisa dibaca Customer Agent

### UC-003: Review Customer Orders

- Actor: Owner via Telegram
- Trigger: owner ingin melihat atau mengelola order
- Precondition: order sudah tercatat di database

Main flow:

1. Owner menjalankan `/order list`.
2. Agent menampilkan order pending atau order terbaru.
3. Owner memilih order tertentu.
4. Owner menjalankan `/order approve [id]` atau `/order reject [id]`.
5. Sistem mengubah status order.
6. Customer menerima update via WhatsApp.

Expected outcome:

- owner bisa mengambil keputusan cepat
- seluruh perubahan status tercatat di audit trail

### UC-004: View Customer Conversations

- Actor: Owner via Telegram
- Trigger: owner ingin memeriksa histori chat customer
- Precondition: conversation logging aktif

Main flow:

1. Owner menjalankan `/customer view [phone]`.
2. Sistem mengambil conversation dari database atau workspace.
3. Agent merangkum atau menampilkan histori chat.
4. Owner memutuskan apakah perlu intervensi.

Expected outcome:

- owner punya visibilitas penuh terhadap interaksi customer

### UC-005: Enable or Disable Customer Agent

- Actor: Owner via Telegram atau dashboard
- Trigger: owner ingin mematikan atau mengaktifkan customer service otomatis
- Precondition: system runtime aktif

Main flow:

1. Owner menjalankan `/customer-agent disable`.
2. Agent mengubah `agent_settings.customer_agent_enabled` menjadi `false`.
3. WhatsApp inbound handler berpindah ke mode offline reply.
4. Customer baru menerima pesan offline sampai owner mengaktifkan kembali.

Alternate flow:

1. Owner menjalankan `/customer-agent enable`.
2. Sistem mengubah setting menjadi aktif.
3. Customer Agent kembali memproses pesan normal.

Expected outcome:

- owner tetap punya kontrol penuh atas otomasi customer

### UC-006: Generate Business Document

- Actor: Owner via Telegram
- Trigger: owner butuh proposal, report, atau business plan
- Precondition: Owner Agent aktif

Main flow:

1. Owner meminta dokumen tertentu.
2. Agent mengumpulkan brief minimum.
3. Agent menghasilkan file markdown.
4. File disimpan di workspace owner.
5. Dashboard dapat menampilkan preview.

Expected outcome:

- owner mendapatkan artifact yang bisa langsung dipakai atau diedit

### UC-007: Generate Brand Guideline

- Actor: Owner via Telegram
- Trigger: owner ingin brand guideline dan design system
- Precondition: owner memberikan preferensi minimum

Main flow:

1. Owner menyebut nama brand, warna, dan preferensi font.
2. Agent membuat guideline markdown dan CSS files.
3. Sistem menyimpan output ke `design-system/`.
4. Dashboard menampilkan preview HTML.

Expected outcome:

- owner memiliki fondasi visual untuk brand bisnis

### UC-008: Low Stock Alert and Restock

- Actor: Owner atau system
- Trigger: stok di bawah threshold
- Precondition: product memiliki `low_stock_at`

Main flow:

1. Cron job atau owner meminta pengecekan stok.
2. Sistem mencari produk yang stoknya rendah.
3. Agent mengirim alert ke Telegram.
4. Owner meminta bantuan restock.
5. Workflow restock membuat draft PO dan menunggu approval owner.

Expected outcome:

- owner mengetahui risiko stok habis lebih awal

## Customer Use Cases

### UC-101: Browse Product Catalog

- Actor: Customer via WhatsApp
- Trigger: customer ingin melihat produk
- Precondition: Customer Agent enabled

Main flow:

1. Customer bertanya produk yang tersedia.
2. Customer Agent membaca katalog.
3. Agent menampilkan daftar produk atau detail produk tertentu.

Expected outcome:

- customer paham pilihan produk tanpa perlu admin manual

### UC-102: Place Order

- Actor: Customer via WhatsApp
- Trigger: customer ingin membeli produk
- Precondition: produk aktif dan stok tersedia

Main flow:

1. Customer menyebut produk dan jumlah.
2. Agent memverifikasi stok.
3. Agent meminta lokasi atau tujuan pengiriman.
4. Sistem menghitung ongkir.
5. Sistem membuat order.
6. Sistem menghasilkan QRIS atau VA payment.
7. Customer melakukan pembayaran.
8. Webhook mengubah status payment menjadi `paid`.
9. Sistem menentukan apakah langsung `processing` atau menunggu approval owner.

Expected outcome:

- order berhasil dibuat dan customer mendapat status jelas

### UC-103: Ask Shipping Cost

- Actor: Customer via WhatsApp
- Trigger: customer ingin tahu ongkir
- Precondition: Customer Agent enabled

Main flow:

1. Customer menyebut kota tujuan.
2. Agent meminta berat barang jika belum diketahui.
3. Sistem memanggil Rajaongkir.
4. Agent menampilkan beberapa opsi courier dan ETA.

Expected outcome:

- customer dapat keputusan sebelum checkout

### UC-104: Check Order Status

- Actor: Customer via WhatsApp
- Trigger: customer ingin melihat progres order
- Precondition: order exists

Main flow:

1. Customer menyebut nomor order.
2. Agent memeriksa status order.
3. Agent mengembalikan status, estimasi, dan info AWB jika tersedia.

Expected outcome:

- customer tidak perlu bertanya manual ke admin

### UC-105: Request Cancellation

- Actor: Customer via WhatsApp
- Trigger: customer ingin membatalkan order
- Precondition: order belum masuk tahap `processing`

Main flow:

1. Customer meminta cancel.
2. Sistem memeriksa status order.
3. Jika masih boleh, sistem membuat `cancel_requested`.
4. Owner diberi notifikasi.
5. Owner mengambil keputusan.
6. Customer menerima hasil keputusan.

Expected outcome:

- proses cancel tercatat dan tidak ambigu

### UC-106: Customer Contacts Business During Offline Mode

- Actor: Customer via WhatsApp
- Trigger: Customer Agent disabled atau business hours rule aktif
- Precondition: sistem menerima pesan inbound

Main flow:

1. Customer mengirim pesan.
2. Sistem memeriksa `agent_settings` dan auto-reply rules.
3. Sistem mengirim pesan offline atau vacation message.
4. Tidak ada autopilot commerce flow yang berjalan.

Expected outcome:

- customer tetap mendapatkan respons yang jelas, walau automation dimatikan

## System Use Cases

### UC-201: Payment Webhook Received

- Actor: Pakasir
- Trigger: pembayaran sukses, expired, atau dibatalkan
- Precondition: payment sudah dibuat

Main flow:

1. Pakasir mengirim webhook ke endpoint backend.
2. Sistem memvalidasi payload.
3. Sistem memperbarui `payments`.
4. Sistem memperbarui `orders.payment_status` dan status order bila perlu.
5. Sistem mencatat `order_status_history`.
6. Customer menerima notifikasi hasil.
7. Owner menerima notifikasi jika kasusnya perlu perhatian.

Expected outcome:

- status pembayaran sinkron antara gateway, database, owner, dan customer

### UC-202: Hourly Stock Check

- Actor: System scheduler
- Trigger: cron job periodik
- Precondition: product dan threshold tersedia

Main flow:

1. Scheduler memeriksa stok.
2. Sistem mencari produk dengan `stock_qty < low_stock_at`.
3. Jika ada, sistem mengirim alert ke owner via Telegram.

Expected outcome:

- owner dapat alert proaktif

### UC-203: Dreaming Cycle

- Actor: System scheduler
- Trigger: session end, hourly, daily
- Precondition: Owner Agent memory aktif

Main flow:

1. Light dream berjalan setelah sesi owner.
2. REM dream berjalan secara berkala untuk konsolidasi.
3. Deep dream berjalan pada jadwal harian.
4. Sistem memperbarui memory store dan `MEMORY.md`.

Expected outcome:

- owner memory berkembang tanpa membuka akses ke Customer Agent

### UC-204: WhatsApp Connection Recovery

- Actor: System runtime
- Trigger: koneksi Baileys terputus
- Precondition: WhatsApp sebelumnya pernah paired

Main flow:

1. Adapter mendeteksi disconnect.
2. Sistem mencoba reconnect otomatis.
3. Jika beberapa percobaan gagal, owner diberi notifikasi.
4. Jika auth invalid, dashboard meminta QR pairing ulang.

Expected outcome:

- channel reliability tetap terjaga

## Edge Cases

### EC-001: Oversell Prevention

Situation:

- customer memesan lebih banyak dari stok yang tersedia

Expected behavior:

1. Sistem menolak generate payment untuk qty yang tidak aman.
2. Agent menawarkan qty yang masih tersedia atau waitlist.
3. Owner tidak menerima order misleading.

### EC-002: Payment Expired

Situation:

- customer tidak membayar sampai QRIS expired

Expected behavior:

1. Sistem menandai payment sebagai `expired`.
2. Customer diberi opsi untuk generate payment ulang.
3. Order tidak lanjut ke processing.

### EC-003: Pakasir Timeout

Situation:

- API payment gagal merespons

Expected behavior:

1. Agent mengembalikan pesan gagal yang jelas.
2. Sistem tidak membuat status sukses palsu.
3. Error tercatat di log.

### EC-004: Owner Overrides Customer Flow

Situation:

- owner perlu mengambil alih interaksi tertentu

Expected behavior:

1. Owner membaca conversation.
2. Owner menjalankan command override atau mengubah status order.
3. Customer Agent mengikuti state terbaru dari sistem.

### EC-005: Vacation Mode

Situation:

- owner ingin menghentikan automation selama periode tertentu

Expected behavior:

1. Rule vacation aktif pada tanggal yang ditentukan.
2. Customer menerima pesan custom.
3. Setelah periode selesai, mode kembali normal atau mengikuti setting owner.

## Data Flow Summary

### Customer Commerce Flow

```text
Customer
-> WhatsApp adapter
-> Customer Agent
-> products / shipping / payment tools
-> database
-> webhook updates
-> customer notification
```

### Owner Control Flow

```text
Owner
-> Telegram adapter
-> Owner Agent
-> tools / workflows / settings update
-> database and workspace
-> outbound notification to customer if needed
```

### Document and Design Flow

```text
Owner request
-> Owner Agent
-> generator tool
-> workspace artifact
-> dashboard preview
```
