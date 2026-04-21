/**
 * ACP admin API routes — session observability and control.
 *
 * Provides HTTP endpoints for:
 * - GET  /acp/sessions          — list ACP sessions for tenant
 * - GET  /acp/sessions/:key     — get single session details
 * - GET  /acp/tasks             — list running detached task runs
 * - POST /acp/sessions/:key/close — close a session
 */

import { registerApiRoute } from '@mastra/core/server';
import { getAcpSessionManager } from '@juragan/core';
import { DEFAULT_TENANT_ID } from '@juragan/shared';

export function registerAcpRoutes() {
  registerApiRoute('/acp/sessions', {
    method: 'GET',
    handler: async () => {
      const manager = getAcpSessionManager();
      const sessions = await manager.listSessions(DEFAULT_TENANT_ID, 50);
      return Response.json({ sessions });
    },
  });

  registerApiRoute('/acp/sessions/:key', {
    method: 'GET',
    handler: async (): Promise<Response> => {
      const url = new URL('', 'http://localhost');
      const key = url.pathname.split('/').pop() ?? '';
      const manager = getAcpSessionManager();
      const cached = manager.getCachedSession(key);
      if (cached) {
        return Response.json({ session: cached, source: 'cache' });
      }
      const sessions = await manager.listSessions(DEFAULT_TENANT_ID, 100);
      const dbSession = sessions.find((s: unknown) => (s as { sessionKey: string }).sessionKey === key);
      if (dbSession) {
        return Response.json({ session: dbSession, source: 'db' });
      }
      return Response.json({ session: null }, { status: 404 });
    },
  });

  registerApiRoute('/acp/tasks', {
    method: 'GET',
    handler: async () => {
      const manager = getAcpSessionManager();
      const tasks = manager.getRunningTaskRuns(DEFAULT_TENANT_ID);
      return Response.json({ tasks });
    },
  });

  registerApiRoute('/acp/sessions/:key/close', {
    method: 'POST',
    handler: async (c): Promise<Response> => {
      const key = (c as { params?: { key?: string } }).params?.key ?? '';
      const manager = getAcpSessionManager();
      const cached = manager.getCachedSession(key);
      if (cached) {
        await manager.closeSession(cached);
      }
      return Response.json({ ok: true, sessionKey: key });
    },
  });
}