import { makeWASocket, useMultiFileAuthState, type WASocket } from 'baileys';

export class WhatsAppChannel {
  private sock: WASocket | null = null;
  private tenantId: string;

  constructor({ tenantId }: { tenantId: string }) {
    this.tenantId = tenantId;
  }

  async connect(): Promise<WASocket> {
    const { state, saveCreds } = await useMultiFileAuthState(
      `data/workspaces/${this.tenantId}/whatsapp/`,
    );
    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
    });
    this.sock.ev.on('creds.update', saveCreds);
    return this.sock;
  }

  getSocket(): WASocket | null {
    return this.sock;
  }

  isConnected(): boolean {
    return this.sock !== null && this.sock.user !== null;
  }
}
