import { createWhatsAppHandler } from './whatsapp-handler.js';
import { DEFAULT_TENANT_ID as tenantId } from '@juragan/shared';
import { type WASocket, makeWASocket, useMultiFileAuthState } from 'baileys';
import { createTelegramSender } from '../reminders/executor.js';

export type WhatsAppStatus = {
  connected: boolean;
  qr: string | null;
};

let _manager: WhatsAppManager | null = null;

export function resetWhatsAppManager(): void {
  _manager = null;
}

export function getWhatsAppManager(): WhatsAppManager {
  if (!_manager) {
    _manager = new WhatsAppManager();
  }
  return _manager;
}

export function phoneToJid(phone: string): string {
  return phone.replace(/^\+/, '') + '@s.whatsapp.net';
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 5000;

class WhatsAppManager {
  private sock: WASocket | null = null;
  private latestQR: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;

  getStatus(): WhatsAppStatus {
    return {
      connected: !!this.sock?.user,
      qr: this.latestQR,
    };
  }

  async connect(): Promise<void> {
    if (this.sock?.user) {
      return;
    }

    this.shouldReconnect = true;
    await this.createConnection();
  }

  private async createConnection(): Promise<void> {
    const authDir = `data/workspaces/${tenantId}/whatsapp/`;
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: console,
    });

    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('connection.update', ({ qr, connection }) => {
      if (qr) {
        this.latestQR = qr;
        this.reconnectAttempts = 0; // reset on new QR
      }
      if (connection === 'close') {
        this.handleDisconnect();
      }
      if (connection === 'open') {
        this.reconnectAttempts = 0;
        this.notifyOwner('WhatsApp connected successfully');
      }
    });

    createWhatsAppHandler(this.sock);
  }

  private handleDisconnect(): void {
    if (!this.shouldReconnect) {
      return;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.notifyOwner('WhatsApp reconnection failed after multiple attempts. Please scan QR again.');
      this.latestQR = null;
      this.reconnectAttempts = 0;
      return;
    }

    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * this.reconnectAttempts; // exponential backoff

    this.notifyOwner(`WhatsApp disconnected. Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.createConnection();
      } catch (err) {
        console.error('Reconnection error:', err);
        this.handleDisconnect();
      }
    }, delay);
  }

  private async notifyOwner(message: string): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const ownerChatId = process.env.TELEGRAM_OWNER_CHAT_ID;
    if (botToken && ownerChatId) {
      const send = createTelegramSender(botToken);
      try {
        await send(ownerChatId, `📱 <b>WhatsApp Status</b>\n\n${message}`);
      } catch (err) {
        console.error('Failed to notify owner:', err);
      }
    }
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.sock) {
      this.sock.end(undefined);
      this.sock = null;
      this.latestQR = null;
    }
    this.reconnectAttempts = 0;
  }

  async sendMessageToJid(
    jid: string,
    content: { text?: string; image?: Buffer; caption?: string },
  ): Promise<void> {
    if (!this.sock) return;
    await this.sock.sendMessage(jid, content);
  }

  getSocket(): WASocket | null {
    return this.sock;
  }

  setQR(qr: string): void {
    this.latestQR = qr;
  }

  clearQR(): void {
    this.latestQR = null;
  }

  setDisconnected(): void {
    this.sock = null;
    this.latestQR = null;
  }
}