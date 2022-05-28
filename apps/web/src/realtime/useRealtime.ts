import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { getAccessToken, onTokenChange } from '@/api/client';
import { keys } from '@/api/queries';

let socket: Socket | null = null;

function connect() {
  socket?.disconnect();
  socket = io({
    path: '/api/socket.io',
    auth: (cb) => cb({ token: getAccessToken() }),
    transports: ['websocket'],
  });
  return socket;
}

export function useRealtime(enabled: boolean) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const bind = (s: Socket) => {
      s.on('surgery.changed', (event: { surgeryId: string }) => {
        qc.invalidateQueries(keys.board);
        qc.invalidateQueries(keys.surgeries, { refetchType: 'active' });
        qc.invalidateQueries(keys.surgery(event.surgeryId));
      });
      s.on('notification.created', () => qc.invalidateQueries(keys.notifications));
    };

    if (getAccessToken()) bind(connect());

    const unsubscribe = onTokenChange((next) => {
      if (!next) socket?.disconnect();
      else if (!socket?.connected) bind(connect());
    });

    return () => {
      unsubscribe();
      socket?.disconnect();
      socket = null;
    };
  }, [enabled, qc]);
}
