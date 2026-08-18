import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { message, notification } from 'antd';

export const CLIENT_VERSION = "1.0.1";

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Determinar la URL del servidor WebSocket (apunta al host actual o proxy)
    const socketUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace('/api', '')
      : window.location.origin;

    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000
    });

    let wasEverConnected = false;

    newSocket.on('connect', () => {
      console.log('[WebSocket] Conectado exitosamente al servidor SGA NouColors');
      setIsConnected(true);
      if (wasEverConnected) {
        message.success({
          content: '✅ Conectado al servidor SGA (Wi-Fi Almacén)',
          key: 'sga_network_status',
          duration: 3
        });
      }
      wasEverConnected = true;
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[WebSocket] Desconectado del servidor SGA:', reason);
      setIsConnected(false);
      message.warning({
        content: '⚠️ Sin conexión con el servidor SGA. Comprueba que estés conectado a la Wi-Fi del almacén (en red 4G/datos no hay acceso local).',
        key: 'sga_network_status',
        duration: 5
      });
    });

    newSocket.on('connect_error', () => {
      setIsConnected(false);
    });

    // Control de Versión en Tiempo Real (Sin forzar recarga brusca durante el trabajo)
    newSocket.on('version_check', (data) => {
      const serverVersion = data?.version;
      console.log(`[Version Control] Versión Cliente: ${CLIENT_VERSION} | Versión Servidor: ${serverVersion}`);

      if (serverVersion && serverVersion !== CLIENT_VERSION) {
        notification.info({
          message: '🔄 Nueva versión disponible (v' + serverVersion + ')',
          description: 'Se ha publicado una actualización en el servidor. Puedes actualizar cuando termines tu tarea actual.',
          btn: (
            <button
              onClick={() => window.location.reload()}
              style={{
                backgroundColor: '#0d6efd',
                color: '#fff',
                border: 'none',
                padding: '4px 12px',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Actualizar ahora
            </button>
          ),
          duration: 0,
          key: 'version_update_notice',
          placement: 'topRight'
        });
      }
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (newSocket && !newSocket.connected) {
          newSocket.connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    setSocket(newSocket);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, clientVersion: CLIENT_VERSION }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
