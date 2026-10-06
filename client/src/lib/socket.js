import { useEffect, useRef } from 'react';
import { API_BASE, getToken } from './api.js';

/**
 * Minimal realtime client over a plain WebSocket (served by a Cloudflare
 * Durable Object). Exposes a socket.io-like on/off/emit API and reconnects
 * automatically with backoff.
 */
class RealtimeSocket {
  constructor() {
    this.handlers = new Map();
    this.closed = false;
    this.retry = 0;
    this.open();
  }

  url() {
    const base = API_BASE || window.location.origin;
    return `${base.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(getToken() || '')}`;
  }

  open() {
    if (this.closed || !getToken()) return;
    const ws = new WebSocket(this.url());
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      clearInterval(this.ping);
      this.ping = setInterval(() => this.emit('ping'), 30000);
    };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      for (const fn of this.handlers.get(msg.event) || []) fn(msg.data);
    };
    ws.onclose = () => {
      clearInterval(this.ping);
      if (this.closed) return;
      const delay = Math.min(30000, 1000 * 2 ** this.retry++);
      this.timer = setTimeout(() => this.open(), delay);
    };
  }

  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
  }

  off(event, fn) {
    this.handlers.get(event)?.delete(fn);
  }

  emit(event, data) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ event, data }));
  }

  disconnect() {
    this.closed = true;
    clearTimeout(this.timer);
    clearInterval(this.ping);
    this.ws?.close();
  }
}

let socket = null;

export function connectSocket() {
  if (!socket) socket = new RealtimeSocket();
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export const getSocket = () => socket;

/** Subscribe to a realtime event for the lifetime of a component. */
export function useSocketEvent(event, handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const s = connectSocket();
    const fn = (...args) => ref.current(...args);
    s.on(event, fn);
    return () => s.off(event, fn);
  }, [event]);
}
