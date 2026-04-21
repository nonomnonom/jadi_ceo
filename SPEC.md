# Pakasir WhatsApp Payment Integration — SPEC

## 1. Objective

Enable customers to pay orders directly via WhatsApp chat using QRIS or Virtual Account, rendered and sent by the Customer Agent.

**Flow:**
```
Customer (WA) → "Saya mau bayar" → Customer Agent → Generate QR/VA via Pakasir API → Send to WA → Customer pays → Webhook confirms → Customer Agent confirms success
```

## 2. Core Features

### 2.1 Payment Link via URL (Simple)
- Owner generates a payment link: `https://app.pakasir.com/pay/{slug}/{amount}?order_id={order_id}`
- Customer Agent sends link in WhatsApp
- Customer clicks → pays in Pakasir app → returns → webhook confirms

### 2.2 QRIS Direct (Full Integration — PRIORITAS)
- Customer Agent calls Pakasir API: `POST /api/transactioncreate/qris`
- Pakasir returns: `payment_number` (QR string), `total_payment`, `expired_at`
- Customer Agent renders QR as image using `qrcode` library
- Customer Agent sends image + nominal + order_id via WhatsApp
- Customer scans with any e-wallet app
- Webhook `POST /webhook` confirms payment → update order status

### 2.3 Virtual Account (Optional)
- Same flow as QRIS, different payment method: `cimb_niaga_va`, `bni_va`, etc.
- Customer Agent sends VA number + nominal

### 2.4 Payment Simulation (Sandbox Only)
- For testing: `POST /api/paymentsimulation`

### 2.5 Transaction Cancel
- Owner can cancel expired unpaid transaction

## 3. Database Changes

### New table: `payments`
```sql
CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id    TEXT    NOT NULL,
  order_id     TEXT    NOT NULL,
  amount_idr   INTEGER NOT NULL,
  fee          INTEGER NOT NULL DEFAULT 0,
  total_payment INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  payment_number TEXT,
  qr_image     TEXT,
  status       TEXT    NOT NULL DEFAULT 'pending',
  expired_at   INTEGER,
  completed_at INTEGER,
  pakasir_response TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
```

### Existing table: `orders` (add columns)
```sql
ALTER TABLE orders ADD COLUMN payment_id INTEGER;
ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'unpaid';
```

## 4. Project Structure

```
apps/api/src/
├── channels/
│   └── whatsapp.ts          # Baileys WhatsApp (existing)
├── tools/
│   ├── owner/
│   │   └── payment-tools.ts # generate-payment-link, cancel-payment
│   └── customer/
│       ├── create-order.ts  # Modified: link to Pakasir
│       ├── request-payment.ts # NEW: create Pakasir transaction, send QR to WA
│       └── check-payment.ts # NEW: check payment status from webhook
├── services/
│   └── pakasir.ts          # NEW: Pakasir API client
├── api-routes.ts
│   └── /custom/pakasir/*   # webhook endpoint, payment status
```

## 5. Pakasir API Service

```typescript
// apps/api/src/services/pakasir.ts
interface PakasirTransaction {
  project: string;      // slug
  order_id: string;
  amount: number;
  api_key: string;
}

interface PakasirResponse {
  payment: {
    project: string;
    order_id: string;
    amount: number;
    fee: number;
    total_payment: number;
    payment_method: string;
    payment_number: string; // QR string or VA number
    expired_at: string;
  };
}

class PakasirService {
  private baseUrl = 'https://app.pakasir.com/api';
  private project: string;
  private apiKey: string;

  async createTransaction(method: 'qris' | 'cimb_niaga_va' | 'bni_va' | ...): Promise<PakasirResponse>;
  async cancelTransaction(orderId: string): Promise<void>;
  async simulatePayment(orderId: string): Promise<void>;
}
```

## 6. Environment Variables

```env
PAKASIR_PROJECT=your_project_slug
PAKASIR_API_KEY=your_api_key
PAKASIR_WEBHOOK_SECRET=optional_secret_for_validation
```

## 7. Webhook Handler

```typescript
// POST /custom/pakasir/webhook
// Payload from Pakasir when payment succeeds:
{
  "amount": 22000,
  "order_id": "INV123",
  "project": "depodomain",
  "status": "completed",
  "payment_method": "qris",
  "completed_at": "2024-09-10T08:07:02.819+07:00"
}
// → Update payments.status = 'completed', orders.payment_status = 'paid'
// → Customer Agent sends confirmation message to WA
```

## 8. Customer Agent Tools (WhatsApp Payment Flow)

### `request-payment`
- Input: `orderId`, `amount`, `paymentMethod` (default: qris)
- Calls Pakasir API
- Renders QR image
- Sends image + details via WhatsApp
- Saves payment record

### `check-payment`
- Input: `orderId`
- Returns payment status from local DB (updated by webhook)

## 9. Boundaries

**DO:**
- Save Pakasir credentials in `settings` table (like openrouterApiKey pattern)
- Use `qrcode` npm package to render QR image from string
- Follow existing code style (Biome format)
- Handle expired payments gracefully

**DON'T:**
- Don't modify existing Telegram channel code
- Don't change existing DB tables (only ADD new columns)
- Don't hardcode Pakasir credentials — always from settings/env
- Don't send payment number/QR to Telegram (owner uses dashboard for this)

## 10. Testing

1. **Sandbox simulation**: Use `/api/paymentsimulation` to test without real money
2. **Manual webhook test**: POST to `/custom/pakasir/webhook` with sample payload
3. **End-to-end**: WA customer → request payment → scan QR → pay → receive confirmation
