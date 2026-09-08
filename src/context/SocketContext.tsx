import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SocketContext = createContext<any>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const uid = user?.id || user?._id;
    if (!uid) return;

    const s = io(API_URL, { transports: ['websocket'] });
    s.on('connect', () => s.emit('join', uid));

    s.on('new-request', (data: any) => {
      toast.show(`New request from ${data.riderName || 'a rider'} (${data.seats} seat${data.seats > 1 ? 's' : ''})`, 'info');
    });

    s.on('booking-updated', (data: any) => {
      if (data.status === 'accepted') toast.show('Your booking was accepted 🎉', 'success');
      else if (data.status === 'rejected') toast.show('Your booking was rejected', 'info');
      else if (data.status === 'paid') toast.show('Payment received for your ride 🎉', 'success');
    });

    s.on('new-message', (data: any) => {
      toast.show(`💬 ${data.senderName || 'New message'}: ${data.message?.text || ''}`, 'info');
    });

    socketRef.current = s;
    setSocket(s);
    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, user?._id]);

  return <SocketContext.Provider value={{ socket }}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
