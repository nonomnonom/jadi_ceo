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
    handler: async () => {
      return Response.json({ error: 'not implemented' }, { status: 501 });
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
    handler: async (): Promise<Response> => {
      const url = new URL('', 'http://localhost');
      const key = url.pathname.split('/').pop() ?? '';
      const manager = getAcpSessionManager();
      const cached = manager.getCachedSession(key);
      if (cached) {
        await manager.closeSession(cached);
      }
      return Response.json({ ok: true, sessionKey: key });
    },
  });
}