# Juragan v1.0 - Product Definition

## Document Status

- Status: Planning
- Purpose: definisi produk dan scope v1.0
- Audience: founder, product, engineering, designer
- Scope: value proposition, fitur, capability, constraint, dan success criteria

## Product Summary

Juragan adalah AI business assistant untuk owner usaha Indonesia. Produk ini dirancang agar owner cukup menyampaikan niat atau kebutuhan bisnis, lalu agent membantu menjalankan pekerjaan operasional, customer support, dan administrasi.

Pada v1.0, Juragan fokus pada dua pengalaman utama:

1. Owner mengelola bisnis lewat Telegram dan dashboard.
2. Customer berinteraksi dengan bisnis lewat WhatsApp secara semi-otomatis atau otomatis.

## Target Users

### Primary Users

- UMKM dan toko online
- penjual berbasis WhatsApp
- pemilik usaha jasa
- trader dan reseller skala kecil sampai menengah

### Secondary Users

- tim admin owner
- supplier yang dihubungi owner melalui workflow
- customer retail yang membeli lewat WhatsApp

## Product Promise

Juragan harus terasa seperti "operator bisnis digital" yang:

- cepat dipakai tanpa setup teknis yang berat
- tetap memberi owner kontrol penuh
- bisa jalan 24/7 untuk customer-facing task
- cukup fleksibel untuk bisnis kecil, tapi tidak terlalu rumit

## Product Principles

1. Owner tetap menjadi pengambil keputusan terakhir.
2. Customer-facing automation harus aman, jelas, dan bisa diaudit.
3. Kesederhanaan lebih penting daripada fitur yang terlalu canggih di awal.
4. Self-hosted harus tetap realistis untuk dijalankan.
5. Setiap fitur baru harus punya alasan bisnis yang jelas.

## Product Surface

### Channel Surfaces

| Surface | User | Purpose |
|---------|------|---------|
| Telegram | Owner | command center, approval, reporting, control |
| WhatsApp | Customer | inquiry, ordering, payment, shipping |
| Dashboard | Owner | setup, monitoring, QR scan, settings, conversation view |

### System Surfaces

| Surface | Purpose |
|---------|---------|
| API backend | runtime agents, routes, integration, storage |
| Workspace files | generated assets, history, design outputs |
| Database | business data and system state |

## Core Product Modules

## Owner Agent

Owner Agent adalah pusat kontrol Juragan.

### Core Capabilities

- full CRUD data bisnis
- akses ke seluruh order dan conversation customer
- command execution via Telegram
- trigger skill dan workflow
- kontrol Customer Agent
- akses memory dan generated artifacts

### Owner Tools

| Tool Group | Key Capabilities |
|------------|------------------|
| Notes | add, list, organize notes |
| Transactions | log income and expense, daily summary |
| Reminders | schedule reminders and recurring prompts |
| Products | add, edit, list, adjust stock |
| Contacts | manage customer and supplier contacts |
| Invoices | create, list, mark paid |
| Reports | cashflow report, sales report, analytics |
| Customer Visibility | read orders and conversations |
| Control | enable or disable Customer Agent |
| Memory | search and read owner memory |
| Content Generation | proposal, pitch deck, report, document |
| Design Generation | brand guideline, CSS system, brand preview |

### Owner Commands

| Command | Purpose |
|---------|---------|
| `/order list` | list pending or recent orders |
| `/order approve [id]` | approve order |
| `/order reject [id]` | reject order |
| `/customer orders` | list customer orders |
| `/customer view [phone]` | view customer conversation |
| `/customer override [id]` | modify or intervene on order |
| `/customer-agent status` | see current status |
| `/customer-agent enable` | enable Customer Agent |
| `/customer-agent disable` | disable Customer Agent |
| `/customer-agent view-all` | inspect all conversations |
| `/model` | show active model |
| `/model [provider/model]` | switch active model |
| `/memory search [query]` | search memory |
| `/memory read [id]` | read memory detail |
| `/skill [name]` | trigger skill manually |
| `/retry` | rerun last failed action |
| `/thread [topic]` | create scoped discussion thread |

## Customer Agent

Customer Agent menangani flow customer via WhatsApp.

### Core Capabilities

- auto-reply WhatsApp 24/7 saat enabled
- product lookup
- order creation
- payment request
- shipping cost calculation
- order status lookup
- cancellation request
- conversation logging

### Customer Tools

| Tool | Purpose |
|------|---------|
| `list-products` | browse catalog |
| `create-order` | create order draft |
| `check-order` | view order status |
| `request-payment` | generate QRIS or VA payment |
| `check-payment` | check payment status |
| `calculate-shipping` | calculate ongkir |
| `track-shipping` | track shipment |
| `request-shipping` | collect destination and courier info |
| `invoice-order` | end-to-end order flow in one chat |
| `request-cancel` | request cancellation |
| `track-delivery` | ask for delivery status |

### Behavioral Constraints

- stateless by design
- tidak boleh mengakses data owner
- harus cek guard condition sebelum action sensitif
- harus escalate ke owner untuk kasus yang tidak aman diproses otomatis

## Dashboard

Dashboard adalah surface setup dan observability.

### Dashboard Responsibilities

- input API keys dan token
- menampilkan QR pairing WhatsApp
- menampilkan status Telegram dan WhatsApp
- enable atau disable Customer Agent
- menampilkan order dan conversation
- preview generated document atau brand assets

### Dashboard Components for v1

| Component | Purpose |
|-----------|---------|
| `ChannelStatus` | show WhatsApp and Telegram state |
| `AgentToggle` | enable or disable Customer Agent |
| `ConversationsViewer` | inspect chat history |
| `OrdersTable` | view and manage orders |
| `DocumentPreview` | preview markdown or generated document |
| `BrandGuidePreview` | preview HTML or CSS design output |

## Payments

Payment flow v1 memakai Pakasir.

### Supported Payment Experience

- owner bisa membuat payment link atau QR secara manual
- customer bisa menerima QRIS lewat WhatsApp
- system menerima webhook payment confirmation
- payment expired dan payment cancel harus tercatat dengan jelas

### Payment State

| State | Meaning |
|-------|---------|
| `pending` | payment dibuat tapi belum dibayar |
| `paid` | webhook confirmed |
| `expired` | QR expired |
| `cancelled` | payment dibatalkan |
| `failed` | request gagal atau invalid |

## Shipping

Shipping flow v1 memakai Rajaongkir.

### Supported Capabilities

- list province dan city
- calculate ongkir
- pilih courier
- simpan pilihan ongkir ke order
- tracking pengiriman bila tracking endpoint tersedia

### Supported Couriers

- JNE
- POS Indonesia
- TIKI

## Documents and Design Outputs

Juragan v1.0 juga berfungsi sebagai assistant untuk artifact generation.

### Business Document Outputs

- proposal
- pitch deck markdown
- business plan
- sales report
- operational report

### Design Outputs

- brand guideline markdown
- `tokens.css`
- `typography.css`
- `components.css`
- `utilities.css`
- `brand-guide.html`

## Skills

Jumlah skill untuk v1 adalah 8.

| Skill | Purpose |
|-------|---------|
| `daily-checkin` | ringkasan pagi dan agenda |
| `customer-followup` | follow-up invoice atau customer |
| `price-calculation` | HPP, margin, simulasi harga |
| `stock-opname` | audit stok |
| `supplier-order` | draft purchase order supplier |
| `wa-blast` | draft pesan massal WhatsApp |
| `invoice-reminder` | reminder invoice overdue |
| `expense-claim` | pencatatan dan approval claim biaya |

## Settings

Semua setting penting harus bisa dikonfigurasi dari dashboard.

| Setting | Purpose |
|---------|---------|
| `openrouterApiKey` | default LLM access |
| `telegramBotToken` | owner communication |
| `pakasirApiKey` | payment gateway |
| `pakasirProject` | Pakasir project slug |
| `rajaongkirApiKey` | shipping API |
| `businessHours` | schedule untuk auto reply |
| `vacationMode` | start, end, custom message |
| `modelConfig` | provider dan model aktif |

## End-to-End Customer Experience

```text
Customer asks about product
-> Customer Agent checks catalog
-> customer chooses product
-> Customer Agent collects quantity and destination
-> system calculates shipping
-> system creates order
-> system requests payment
-> customer pays
-> webhook confirms payment
-> system decides auto-process or owner approval
-> customer receives status update
```

## Order Lifecycle

| Status | Meaning |
|--------|---------|
| `pending` | order dibuat, belum dibayar |
| `paid` | payment confirmed |
| `processing` | order sedang diproses |
| `shipped` | AWB sudah ada, sudah dikirim |
| `completed` | order selesai |
| `cancel_requested` | customer minta cancel |
| `cancelled` | dibatalkan |
| `rejected` | ditolak owner |

## Smart Auto-Processing Rules

| Condition | Expected Action |
|-----------|-----------------|
| stock cukup dan `auto_process=true` | langsung ke processing |
| stock cukup dan `auto_process=false` | tunggu approval owner |
| stock kurang | escalate ke owner |
| payment expired | tawarkan generate ulang |
| customer request cancel sebelum processing | buat cancel request |

## Product Boundaries for v1

### In Scope

- dua agent utama
- Telegram owner flow
- WhatsApp customer flow
- payment via Pakasir
- shipping via Rajaongkir
- dashboard setup dan observability
- skill owner inti
- workflow approval dasar

### Out of Scope for v1

- refund otomatis via gateway
- omnichannel selain Telegram dan WhatsApp
- advanced CRM segmentation
- multi-warehouse inventory
- complex team roles dan RBAC penuh

## Success Criteria

Juragan v1 dianggap siap untuk release internal jika:

1. owner bisa setup token dan pairing WhatsApp dari dashboard
2. customer bisa chat, order, dan bayar via WhatsApp
3. owner bisa lihat order dan percakapan customer
4. owner bisa enable atau disable Customer Agent kapan saja
5. workflow approval sederhana berjalan dengan baik
6. data owner dan customer tetap terisolasi sesuai desain

## Product Readiness Notes

### Self-Hosted

- target utama v1
- open source
- cocok untuk owner yang mau kontrol penuh

### SaaS Readiness

Fondasi multi-tenant dan workspace isolation harus dirancang sejak awal, walau cloud hosted version belum menjadi fokus implementasi v1.
