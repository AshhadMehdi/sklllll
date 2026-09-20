import { io, type Socket } from 'socket.io-client';
import { useEffect } from 'react';
import { useAuth } from '@/stores/auth';

let socket: Socket | null = null;
let currentToken: string | null = null;

export function getSocket(): Socket | null {
  const token = useAuth.getState().token;
  if (!token) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    return null;
  }
  if (!socket || currentToken !== token) {
    socket?.disconnect();
    currentToken = token;
    socket = io('/', { path: '/socket.io', auth: { token }, transports: ['websocket', 'polling'], reconnectionDelayMax: 5000 });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  currentToken = null;
}

/** Subscribe to a socket event for the lifetime of the component. */
export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void, deps: unknown[] = []) {
  const token = useAuth((s) => s.token);
  useEffect(() => {
    if (!token) return;
    const s = getSocket();
    if (!s) return;
    const fn = (p: T) => handler(p);
    s.on(event, fn);
    return () => {
      s.off(event, fn);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, token, ...deps]);
}

/** Join an order room so we receive granular updates for it. */
export function useOrderRoom(orderId: string | undefined) {
  const token = useAuth((s) => s.token);
  useEffect(() => {
    if (!orderId || !token) return;
    const s = getSocket();
    if (!s) return;
    const join = () => s.emit('order:join', orderId);
    join();
    s.on('connect', join);
    return () => {
      s.off('connect', join);
      s.emit('order:leave', orderId);
    };
  }, [orderId, token]);
}
