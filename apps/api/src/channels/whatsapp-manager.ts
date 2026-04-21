import { DEFAULT_TENANT_ID as tenantId } from '@juragan/shared';
import { type WASocket, makeWASocket, useMultiFileAuthState } from 'baileys';

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

class WhatsAppManager {
  private sock: WASocket | null = null;
  private latestQR: string | null = null;

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

    const authDir = `data/workspaces/${tenantId}/whatsapp/`;
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
    });

    this.sock.ev.on('creds.update', saveCreds);
    this.sock.ev.on('connection.update', ({ qr }) => {
      if (qr) {
        this.latestQR = qr;
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.sock) {
      this.sock.end(undefined);
      this.sock = null;
      this.latestQR = null;
    }
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
