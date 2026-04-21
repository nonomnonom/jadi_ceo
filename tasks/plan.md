# Juragan v1.0 - Implementation Plan

## Document Status

- Status: Planning
- Purpose: roadmap implementasi v1.0
- Audience: founder, engineering lead, execution owner
- Scope: fase kerja, dependency, deliverable, exit criteria, dan verification

## Planning Intent

Dokumen ini mengubah visi Juragan menjadi roadmap implementasi yang realistis. Karena proyek masih di tahap planning, fokus dokumen ini adalah:

- mengurutkan prioritas yang benar
- memisahkan core v1 dari future scope
- memastikan setiap fase menghasilkan outcome yang bisa diuji

## Guiding Rules

1. Bangun jalur revenue dan operasional inti terlebih dahulu.
2. Prioritaskan reliability dan data isolation dibanding gimmick.
3. Semua flow customer-facing harus bisa diamati owner.
4. Dashboard cukup untuk setup dan observability, bukan pusat semua logika.
5. Workflow dan memory baru dianggap sukses jika benar-benar bertahan saat restart.

## v1 Priority Stack

Urutan prioritas untuk eksekusi:

1. infrastructure and channel connectivity
2. customer commerce core
3. owner control and visibility
4. workflow and approval engine
5. dashboard observability
6. advanced content generation and business intelligence

## Phase Overview

| Phase | Focus | Outcome |
|-------|-------|---------|
| 1 | Infrastructure | WhatsApp, schema, settings, pairing, channel runtime |
| 2 | Customer Commerce Core | inquiry, order, payment, shipping, logging |
| 3 | Owner Core | owner agent, CRUD, visibility, control |
| 4 | Commands and Control | Telegram commands dan operator flow |
| 5 | Skills and Automation | 8 owner skills aktif |
| 6 | Memory System | short-term memory dan dreaming cycle |
| 7 | Workflows | durable approval-based workflows |
| 8 | Dashboard | observability dan operational UI |
| 9 | Integration and Deployment Readiness | test end-to-end, docker, operational checks |

## Phase 1 - Infrastructure

### Goal

Membangun fondasi teknis agar WhatsApp, database, API settings, dan runtime agent bisa hidup dengan benar.

### Workstreams

- install dependency channel baru
- update schema database
- implement adapter WhatsApp via Baileys
- buat QR pairing flow untuk dashboard
- simpan credential dan status channel
- verifikasi koneksi dan reconnect behavior

### Deliverables

- WhatsApp bisa paired dari dashboard
- API key penting bisa dikonfigurasi dari dashboard
- database schema v1 tersedia
- system bisa menerima dan mengirim pesan WhatsApp dasar

### Exit Criteria

- owner melihat QR pairing
- owner scan QR dan channel menjadi connected
- ada route status dan route disconnect/connect
- reconnect dan auth persistence bekerja minimal untuk skenario normal

## Phase 2 - Customer Commerce Core

### Goal

Menjadikan Customer Agent sebagai customer support dan order intake engine yang usable.

### Scope

- customer agent creation
- list produk
- create order
- check order
- conversation logging
- enable atau disable guard
- payment integration
- shipping integration
- end-to-end invoice order flow

### Deliverables

- customer bisa chat dan tanya produk
- customer bisa membuat order
- customer bisa menerima QRIS atau VA
- customer bisa cek ongkir
- customer bisa cek status order
- semua percakapan tercatat

### Exit Criteria

- order berhasil masuk database dari chat WhatsApp
- payment webhook mengubah status order
- offline mode bekerja saat Customer Agent dimatikan
- oversell prevention berjalan

## Phase 3 - Owner Core

### Goal

Menjadikan Owner Agent sebagai pusat kontrol bisnis dengan akses penuh dan visibilitas customer.

### Scope

- owner agent setup
- owner workspace
- migrasi tool existing ke namespace owner
- add tools untuk customer visibility
- add tools untuk cashflow, expense category, stock movement, memory
- wire Telegram ke owner agent

### Deliverables

- owner bisa menjalankan operasi bisnis utama via Telegram
- owner bisa membaca seluruh order dan conversation customer
- owner bisa mengubah status Customer Agent

### Exit Criteria

- Telegram polling atau delivery berjalan stabil
- owner CRUD inti berfungsi
- customer data read tools berfungsi

## Phase 4 - Commands and Control

### Goal

Menstandarkan operator experience lewat command Telegram.

### Scope

- command parser
- command registry
- `/order`
- `/customer`
- `/customer-agent`
- `/model`
- `/memory`
- `/skill`
- `/retry`
- `/thread`

### Deliverables

- semua command penting tersedia
- error handling untuk unknown command jelas
- model router dapat dikendalikan runtime

### Exit Criteria

- owner dapat menjalankan command harian tanpa fallback ke dashboard
- command hasilnya konsisten dengan data yang ada di DB

## Phase 5 - Skills and Automation

### Goal

Mengaktifkan skill owner yang langsung berguna untuk operasi bisnis.

### Scope

- review 3 skill existing
- tambah 5 skill baru
- registrasi skill ke workspace owner
- tes trigger dan manual execution

### Deliverables

- 8 skill aktif
- owner bisa memanggil skill via `/skill`

### Exit Criteria

- setiap skill punya deskripsi, trigger, dan output yang jelas
- tidak ada skill yang mengakses domain di luar boundary-nya

## Phase 6 - Memory System

### Goal

Menyediakan memory system hanya untuk Owner Agent.

### Scope

- persistence memory store
- light dream
- REM dream
- deep dream
- `MEMORY.md` refresh
- search dan recall tracking

### Deliverables

- owner memory dapat dicari
- knowledge penting terkonsolidasi
- Customer Agent tetap stateless

### Exit Criteria

- memory entries tersimpan lintas sesi
- dreaming jobs bisa dijalankan tanpa merusak data

## Phase 7 - Workflows

### Goal

Mengaktifkan workflow durable yang benar-benar menghemat kerja owner.

### Scope

- `order-approval`
- `restock`
- `customer-followup`
- suspend atau resume integration dari Telegram

### Deliverables

- workflow approval berjalan
- workflow bisa survive restart
- owner bisa approve dari command atau button

### Exit Criteria

- minimal satu flow approval berhasil end-to-end
- run yang tersuspend bisa dilanjutkan setelah restart

## Phase 8 - Dashboard

### Goal

Menyediakan dashboard yang cukup untuk setup dan monitoring, bukan untuk memindahkan seluruh logic dari agent ke UI.

### Scope

- channel status
- agent toggle
- conversations viewer
- orders table
- document preview
- brand guide preview

### Deliverables

- owner bisa setup dan memantau sistem tanpa buka database langsung
- observability dasar tersedia

### Exit Criteria

- status WhatsApp dan Telegram terlihat
- order dan conversation bisa dilihat
- toggle Customer Agent bekerja dari UI

## Phase 9 - Integration and Deployment Readiness

### Goal

Memastikan semua flow inti bekerja bersama dalam lingkungan yang mendekati produksi.

### Scope

- end-to-end test
- docker readiness
- environment variable review
- persistence review
- operational checklist

### Deliverables

- flow utama lolos pengujian
- deployment docs dan env examples masuk akal
- restart behavior tidak merusak state penting

### Exit Criteria

- order flow, control flow, dan isolation flow lolos uji
- dockerized app dapat dijalankan dengan config yang jelas

## Dependencies by Phase

| Dependency | Needed By |
|------------|-----------|
| DB schema update | phase 2, 3, 7, 8 |
| WhatsApp adapter | phase 2, 8, 9 |
| Telegram owner channel | phase 3, 4, 7, 9 |
| settings management | phase 1, 2, 8 |
| workflow persistence | phase 7, 9 |

## Recommended Execution Order Inside Engineering

1. schema and settings foundation
2. WhatsApp adapter and pairing
3. customer tools and order logging
4. payment and shipping integrations
5. owner visibility tools
6. command layer
7. workflows
8. dashboard finishing
9. memory and advanced generation

## Risk Register

### Product Risks

- scope terlalu lebar untuk v1 jika semua advanced generation dikerjakan terlalu awal
- customer-facing errors dapat langsung memengaruhi trust bisnis owner

### Technical Risks

- Baileys reconnect dan auth persistence
- webhook race condition antara payment status dan order update
- stock decrement yang tidak idempotent
- boundary akses customer vs owner yang bocor melalui tool

### Operational Risks

- owner tidak paham status runtime jika dashboard observability lemah
- payment expired dan cancel flow membingungkan bila state machine tidak tegas

## Release Definition for Internal Beta

Juragan siap masuk internal beta jika:

1. owner bisa setup token dan scan QR sendiri
2. customer bisa order dan bayar via WhatsApp
3. owner bisa melihat dan mengelola order
4. owner bisa mematikan atau menyalakan Customer Agent
5. workflow approval sederhana berjalan
6. isolation rule tervalidasi

## Verification Matrix

- [ ] V1 WhatsApp pairing berhasil dari dashboard
- [ ] V2 Customer chat mendapat respons yang sesuai
- [ ] V3 Customer order tersimpan di database
- [ ] V4 Payment webhook mengubah status order
- [ ] V5 Owner menerima notifikasi order via Telegram
- [ ] V6 Owner approve atau reject order dari Telegram
- [ ] V7 Customer Agent offline mode bekerja
- [ ] V8 Owner bisa melihat conversation customer
- [ ] V9 Owner CRUD inti berjalan
- [ ] V10 Semua command inti berjalan
- [ ] V11 8 skill owner tersedia
- [ ] V12 Workflow approval survive restart
- [ ] V13 Dashboard menunjukkan status runtime yang benar
- [ ] V14 Data isolation tervalidasi
- [ ] V15 Docker deployment checklist lulus
