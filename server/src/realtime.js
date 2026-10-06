import { DurableObject } from 'cloudflare:workers';

/**
 * A single Durable Object that holds every connected WebSocket, tagged by
 * user id. Workers call broadcast() to push events to specific users.
 * Uses the hibernation API so idle connections cost nothing.
 */
export class Realtime extends DurableObject {
  async fetch(request) {
    const userId = Number(request.headers.get('x-user-id'));
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [`u:${userId}`]);
    server.serializeAttachment({ userId });
    return new Response(null, { status: 101, webSocket: client });
  }

  broadcast(userIds, event, data) {
    const msg = JSON.stringify({ event, data });
    for (const id of new Set(userIds)) {
      for (const ws of this.ctx.getWebSockets(`u:${id}`)) {
        try { ws.send(msg); } catch { /* socket already closed */ }
      }
    }
  }

  webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.event === 'ping') return ws.send(JSON.stringify({ event: 'pong' }));
    if (msg.event === 'typing') {
      const { userId } = ws.deserializeAttachment();
      const { conversationId, memberIds = [] } = msg.data || {};
      this.broadcast(memberIds.filter((id) => id !== userId).slice(0, 200), 'typing', { conversationId, userId });
    }
  }

  webSocketClose(ws, code) {
    try { ws.close(code, 'closing'); } catch { /* ignore */ }
  }
}

/** Push an event to users from any request handler without blocking the response. */
export function emitToUsers(c, userIds, event, data) {
  if (!userIds.length) return;
  const stub = c.env.REALTIME.get(c.env.REALTIME.idFromName('global'));
  c.executionCtx.waitUntil(stub.broadcast(userIds, event, data).catch(() => {}));
}
